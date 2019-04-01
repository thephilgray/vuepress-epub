module.exports = ctx => ({
  title: 'Testing EPUB',
  description: 'Getting started',
  dest: 'builds/dist.epub/OEBPS',
  plugins: [
    [
      require('./scaffold-epub-plugin'),
      {
        count: 10
      }
    ],
    [
      `dehydrate`, 
      {
        noScript:[
          '**/*.html'
        ]
      }
    ]
  ]
});
