const path = require('path');
const fse = require('fs-extra');
const multiparty = require('multiparty');

// 获取文件名的后缀名
const extractExt = filename => filename.slice(filename.lastIndexOf('.'), filename.length);

// 大文件储存目录
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target');

// 获取POST请求的数据
const resolvePost = req => 
    new Promise(resolve => {
        let chunk = '';
        req.on('data', data => {
            chunk+=data;
        })
        req.on('end', () => {
            resolve(JSON.parse(chunk));
        })
    })

module.exports = class {
    async handleFormData(req, res) {
        const multipart = new multiparty.Form(); // 处理表单中有文件的一个node插件
        multipart.parse(req, async (err, fields, files) => {
            if (err) {
                res.status = 500;
                res.end('process file chunk failed');
                return;
            }
            const [chunk] = files.chunk;
            const [hash] = fields.hash;
            const [filename] = fields.filename;
            const [fileHash] = fields.fileHash;

            // 文件路径
            const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${extractExt(filename)}`);

            // 文件夹路径
            const chunkDir = path.resolve(UPLOAD_DIR, fileHash);

            // 文件存在直接返回
            if(fse.existsSync(filePath)) {
                res.end('file exist');
                return;
            }

            // 切片目录不存在，创建切片目录
            if (!fse.existsSync(chunkDir)) {
                await fse.mkdirs(chunkDir)
            }
            // 将创建在临时目录下的文件移动到对应的文件夹中
            await fse.move(chunk.path, path.resolve(chunkDir, hash));
            res.end("received file chunk");
        })
    }
    // 验证是否已上传/已上传切片下标
    async handleVerifyUpload(req, res) {
        const data = await resolvePost(req);
        const { filename, fileHash } = data;
        const ext = extractExt(filename);
        const filePath = path.resolve(UPLOAD_DIR, `${filename}${ext}`);  // 拼接客户端传过来的文件名跟后缀成一个新的路径。
        if(fse.existsSync(filePath)) {   // 判断这个路径是否已经在服务端创建了。
            res.end( 
                JSON.stringify({
                    shouldUpload: false,
                    upLoadedList: []
                })
            )
        } else {
            res.end(
                JSON.stringify({
                    shouldUpload: true,
                    upLoadedList: []
                })
            )
        }
    }
}