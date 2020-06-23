const path = require('path')
function resolve(dir) {
  return path.join(__dirname, dir)
}

module.exports = {
    devServer: {
        open: true,
        host: '0.0.0.0',
        port: 8080,
        https: false,
        hotOnly: false,
    }
}