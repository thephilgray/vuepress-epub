const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const prettier = require('prettier');
const AssetsWebpackPlugin = require('assets-webpack-plugin');
const _ = require('lodash');

const PLUGIN_NAME = 'scaffold-epub-plugin';

/* reusable helper functions */
const createFileFromTemplate = async (template, data = {}, filePath) => {
  const destDir = path.dirname(filePath);
  await fs
    .ensureDir(destDir)
    .catch(
      e => new Error(`Could not create new directory ${destDir}. \n ${err}`)
    );
  console.log(chalk.green('success'), `${destDir} created.`);
  await fs
    .writeFile(filePath, template(data))
    .catch(
      e =>
        new Error(`Could not create file ${path.basename(filePath)}. \n ${e}`)
    );
  console.log(chalk.green('success'), `${path.basename(filePath)} created.`);
};

const createTemplate = (strings, ...values) => data =>
  strings.reduce(
    (acc, curr, i) => acc + curr + (values[i] ? values[i](data) : ''),
    ''
  );

/* templates */
const mimetypeTemplate = createTemplate`application/epub+zip`;

const containerTemplate = createTemplate`<?xml version="1.0" encoding="UTF-8"?>
  <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
    <rootfiles>
      <rootfile full-path="${locals => locals.opfPath}"
        media-type="application/oebps-package+xml"/>
    </rootfiles>
  </container>`;

/* the plugin */
module.exports = (options, ctx) => {
  return {
    name: PLUGIN_NAME,
    chainMarkdown(config) {
      config.options.xhtmlOut(true);
    },
    chainWebpack(config, isServer) {
      if (!isServer) {
        config
          .plugin('assets')
          .use(AssetsWebpackPlugin, [
            { path: path.resolve(ctx.outDir, `../../../../.vuepress/${PLUGIN_NAME}`) }
          ]);
      }
    },
    async generated(pagePaths) {
      const epubPath = path.resolve(ctx.outDir, '..');
      const opfPath = path.basename(ctx.outDir) + '/content.opf';
      const mimetypePath = path.join(epubPath, 'mimetype');
      const containerPath = path.join(epubPath, 'META-INF', 'container.xml');

      pagePaths.forEach(async page => {
        const html = await fs.readFile(page, 'utf8');
        try {
          const prettyHtml = await prettier.format(html, {
            parser: 'html',
            htmlWhitespaceSensitivity: 'css'
          });
          await createFileFromTemplate(() => prettyHtml, {}, page);
        } catch (e) {
          console.log(chalk.red(`Prettier error:\n${e}`));
        }
      });

      await createFileFromTemplate(mimetypeTemplate, {}, mimetypePath);
      await createFileFromTemplate(
        containerTemplate,
        { opfPath },
        containerPath
      ).catch(e => console.error(chalk.red(e)));

      // TODO: map over all file assets to build metadata and spine, and generate content.opf from template

      // read webpack-assets-json
      const contentTemplate = createTemplate`<?xml version="1.0" encoding="utf-8" standalone="yes"?><package xmlns="http://www.idpf.org/2007/opf" prefix="ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/ rdf: http://www.w3.org/1999/02/22-rdf-syntax-ns#" unique-identifier="isbn" version="3.0" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${locals =>
        locals.title}</dc:title></metadata><manifest>
    ${({ assets }) =>
      assets
        .map(
          asset =>
            `<item href="${asset.href}" id="a-${asset.id}" media-type="${
              asset.mediaType
            }"/>`
        )
        .join('')}
    </manifest>
    <spine toc="toc">
    ${({ pages }) =>
      pages.map(page => `<itemref idref="${path.basename(page)}"/>`).join('')}
    </spine>
    </package>`;
      const mediaTypes = require('./mediaTypes.js');
      const json = await fs.readFile(
        path.resolve(ctx.outDir, `../../../../.vuepress/${PLUGIN_NAME}/webpack-assets.json`),
        'utf-8'
      );
      const assetsJson = JSON.parse(json);
      const pages = ctx.pages.map(p => p.path);
      const assets = Object.keys(assetsJson)
        .reduce((acc, curr) => {
          const files = _.flatten(
            Object.entries(assetsJson[curr]).map(f => f[1])
          ).filter(
            asset =>
              Object.keys(mediaTypes).indexOf(asset.split('.').pop()) > -1
          );
          return [...acc, ...files];
        }, [])
        .concat(pages)
        .map(asset => ({
          href: asset.slice(1),
          mediaType: mediaTypes[asset.split('.').pop()],
          id: path.basename(asset)
        }));

      await createFileFromTemplate(
        contentTemplate,
        { assets, pages },
        path.join(ctx.outDir, '/content.opf')
      );
    }
  };
};
