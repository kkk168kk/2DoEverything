# 2DoEverything

一个 Windows 桌面待办工具。随手记下想做的事，按日期查看，做完一件就划掉一件。

## 下载与使用

1. 打开 [v0.2.2 发布页](https://github.com/kkk168kk/2DoEverything/releases/tag/v0.2.2)，在 **Assets** 下下载 `2DoEverything-UI-fix.zip`。
2. 在 Windows 10 或 11（x64）上完整解压 ZIP。
3. 双击解压目录里的 `2DoEverything.exe`。

## 功能

- 按日期查看待办，为任务添加优先级和备注。
- 用文字或语音添加任务，也可以用 `Ctrl + Shift + X` 快速录入。
- 导出按日期整理的 Markdown 待办记录，方便回顾，也可以将文件发给 AI 总结。
- 在浅色与深色主题间切换，在设置里选择是否开机启动。

## 应用代码

`app/` 收录从 Windows 便携版的 Electron `app.asar` 提取的可编辑代码。前端保留为已打包的 React JavaScript 和 CSS，还包含 Electron 主进程和预加载脚本。

- [`app/dist/`](app/dist/) 包含界面、样式和图片。
- [`app/dist-electron/`](app/dist-electron/) 包含窗口、SQLite 数据存储和导出等逻辑。
- [`tools/`](tools/) 包含 ASAR 解包和回包工具。

## 修改后回包

先下载并完整解压便携版，保留其中的 `resources` 目录。修改 `app/` 后，在仓库根目录用 Node.js 18 或更新版本运行下列命令。把第一行路径换成你电脑上解压后的 `resources` 路径。

```powershell
$resources = 'D:\2DoEverything\resources'
node tools/repack-asar.js --asar "$resources\app.asar" --src app --out "$resources\app.asar.new"
```

完全退出程序后，先备份原来的 `app.asar`，再把 `app.asar.new` 改名为 `app.asar`。重新打开 `2DoEverything.exe` 即可查看改动。
