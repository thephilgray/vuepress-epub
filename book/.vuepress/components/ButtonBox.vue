<template>
  <div>
    <figure>
      <p>
        <strong>{{count}}</strong>
      </p>
    </figure>
    <button @click="clickHandler">Click</button>
  </div>
</template>
<script>
export default {
  data() {
    return {
      count: 0
    };
  },
  methods: {
    clickHandler() {
      this.count++;
    }
  }
};
</script>
<style>
figure {
  background: lightblue;
}
</style>
