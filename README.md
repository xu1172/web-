# web-
一些成品和半成品ai agent实现web端爬虫项目。/Implement web crawler projects with a number of finished and semi-finished AI Agents.

dy和b站可以关注何老师，我是他粉丝这些是从他那分享的

用的mcp工具是js-reverse-mcp浏览器是adspower浏览器 

adsport-launcher.js 是一个智能桥接器
js-reverse-mcp 启动 
  → adsport-launcher.js 查 AdsPower API (127.0.0.1:50325)
    → 发现活跃浏览器的 CDP debug_port
      → 用 --browserUrl http://127.0.0.1:{debug_port} 启动 js-reverse-mcp
        → js-reverse-mcp 直接控制 AdsPower 指纹浏览器！
        可以让claude code帮你完成这个配置

        
