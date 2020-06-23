<template>
  <div id="app">
    <input type="file" id="file" @change="handleFileChange"/>
    <el-button @click="handleUpload">上传</el-button>
    <div>
      <div>文件计算hash</div>
      <el-progress :percentage="hashPercentage"></el-progress>
    </div>
    <div>
      <div>文件总进度</div>
      <el-progress :percentage="fakeUploadPercentage"></el-progress>
    </div>
    <el-table :data="data">
      <el-table-column label="文件hash" prop="hash" align="center"/>
      <el-table-column label="文件大小(KB)" prop="size" align="center">
        <template v-slot="{row}">
          {{row.size | getComputedSize}}
        </template>
      </el-table-column>
      <el-table-column label="进度" align="center">
        <template v-slot="{row}">
          <el-progress :percentage="row.percentage"/>
        </template>
      </el-table-column>
    </el-table>
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
    fakeUploadPercentage: 0, // 上传文件总进度
    hashPercentage: 0, // 文件内容hash
    container: {
      file: '',
      worker: ''
    },
    status: '',
    data: [],
    requestList: [],
  }),
  filters: {
    getComputedSize(value) {
      return parseInt((value / 1024).toFixed(2)) + 'KB';
    }
  },
  computed: {
    // 计算所有切片的进度
    uploadPercentage() {
      if (!this.container.file || !this.data.length) return 0;
      const loaded = this.data
        .map(item => item.size * item.percentage)
        .reduce((acc, cur) => acc + cur); // 已经上传的文件大小
      return parseInt((loaded / this.container.file.size).toFixed(2));
    }
  },
  watch: {
    uploadPercentage(now) {
      if (now > this.fakeUploadPercentage) {
        this.fakeUploadPercentage = now;
      }
    }
  },
  methods: {
    // 封装的ajax
    request({
      url,
      method = "post",
      data,
      headers = {},
      requestList,
      onProgress = e => e
    }) {
      return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.upload.onprogress = onProgress
        Object.keys(headers).forEach(key =>
          xhr.setRequestHeader(key, headers[key])
        );
        xhr.send(data);
        xhr.onload = e => {
          if (requestList) {
            const xhrIndex = requestList.findIndex(item => item === xhr);
            requestList.splice(xhrIndex, 1);
          }
          resolve({
            data: e.target.response
          });
        };
        if (requestList) {
          requestList.push(xhr); // 控制每个请求
        }
      });
    },
    // 根据文件内容计算hash。为了防止阻塞UI线程。使用了web workers单独开一个线程
    calculateHash(fileChunkList) {
      return new Promise(resolve => {
        this.container.worker = new Worker('/hash.js');  
        this.container.worker.postMessage({ fileChunkList });
        this.container.worker.onmessage = (e) => {
          const { percentage, hash } = e.data;
          this.hashPercentage = percentage;
          if(hash) {
            resolve(hash)
          }
        }
      })
    },
    // 对文件进行切片
    createFileChunk(file, size = SIZE) { 
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
    // 点击上传
    async handleUpload() {
      if (!this.container.file) return;
      this.status = Status.uploading; // 修改上传状态
      const fileChunkList = this.createFileChunk(this.container.file);
      this.container.hash = await this.calculateHash(fileChunkList); // 把切片扔给web worker线程。计算hash
      const { shouldUpload, upLoadedList } = await this.verifyUpload(
        this.container.file.name,
        this.container.hash
      );
      console.log(upLoadedList, '----');
      if (!shouldUpload) {  // 如果服务端已经存在了上传的相同内容。那么直接提示上传成功即可
        this.$message.success("秒传：上传成功");
        this.status = Status.wait;
        return;
      }
      this.data = fileChunkList.map(({file}, index) => {
        return {
          hash: this.container.hash + '-' + index, // 每个切片的hash
          index,
          fileHash: this.container.hash, // 文件的hash
          size: file.size,
          chunk: file,
          percentage: upLoadedList.includes(index) ? 100: 0, // 判断当前切片是否已经上传过
        }
      })
      await this.uploadChunks(upLoadedList)
    },
    // 把切片好的文件数据发送给服务端
    async uploadChunks(upLoadedList = []) {
      const requestList = this.data.map(({chunk, hash, index})=>{
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('hash', hash);
        formData.append('filename', this.container.file.name);
        formData.append('fileHash', this.container.hash);
        return {formData, index}
      }).map(({formData, index}) => {
        this.request({
          url: 'http://localhost:3000',
          data: formData,
          onProgress: this.createProgressHandler(this.data[index]),
          requestList: this.requestList
        })
      })
      await Promise.all(requestList);
    },
    createProgressHandler(item) {
      return e => {
        item.percentage = parseInt(String(e.loaded / e.total * 100));
      }
    },
    // 发送请求验证文件是否存在
    async verifyUpload(filename, fileHash) {
      const { data } = await this.request({
        url: 'http://localhost:3000/verify',
        headers: {
          'Content-type': 'application/json'
        },
        data: JSON.stringify({
          filename,
          fileHash
        })
      })
      return JSON.parse(data);
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
