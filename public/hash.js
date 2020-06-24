importScripts('/spark-md5.min.js');

self.onmessage = (e) => {
    const { fileChunkList } = e.data;
    const spark = new self.SparkMD5.ArrayBuffer();  
    let count = 0;
    let percentage = 0;
    const loadNext = index => {
        const render = new FileReader();
        render.readAsArrayBuffer(fileChunkList[index].file); // 把切片文件的内容转化成Buffer格式。
        render.onload = e => {  // 监听当前切片是否成功。
            spark.append(e.target.result);
            ++count
            if(count === fileChunkList.length) { // 全部转化之后对主线程返回 进度100用来做进度条以及hash值
                self.postMessage({
                    percentage: 100,
                    hash: spark.end()
                })
                self.close();
            } else {
                percentage += 100/fileChunkList.length; // 根据转化了几个来告诉主线程的进度条到哪。
                self.postMessage({
                    percentage
                })
                loadNext(count)
            }
        }
        
    }
    loadNext(0)
}