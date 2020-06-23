<template>
  <div id="app">
    <input type="file" id="file" @change="handleFileChange"/>
    <el-button @click="handleUpload">上传</el-button>
  </div>
</template>

<script>
const Status = {
  wait: 'wait',
  pause: 'pause',
  uploading: 'uploading'
}
const SIZE = 100 * 1024; // 切片大小
export default {
  name: 'App',
  data: ()=>({
    container: {
      file: '',
      worker: ''
    },
    status: ''
  }),
  methods: {
    calculateHash(fileChunkList) {
      this.container.worker = new Worker('/hash.js');  // 根据文件内容计算hash。为了防止阻塞UI线程。使用了web workers单独开一个线程
      this.container.worker.postMessage({ fileChunkList });
      this.container.worker.onmessage = (e) => {
        console.log(e.data);
      }
    },
    createFileChunk(file, size = SIZE) { // 对文件进行切片
      const fileChunkList = [];
      let cur = 0;
      while (cur < file.size) {
        fileChunkList.push({ file: file.slice(cur, cur + size) });
        cur += size;
      }
      return fileChunkList;
    },
    handleFileChange(e) {
      const [file] = e.target.files;
      this.container.file = file;
    },
    async handleUpload() {
      if (!this.container.file) return;
      this.status = Status.uploading; // 修改上传状态
      const fileChunkList = this.createFileChunk(this.container.file);
      this.container.hash = await this.calculateHash(fileChunkList); // 把切片扔给web worker线程。计算hash
      // this.data = fileChunkList.map(({ file }, index) => ({
      //   chunk: file,
      //   hash: this.container.file.name + "-" + index // 文件名 + 数组下标
      // }));
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
