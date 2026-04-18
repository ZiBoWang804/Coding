@echo off
setlocal
pushd "%~dp0.."
set "npm_config_cache=%CD%\.npm-cache"
if not exist "output\submission_screens" mkdir "output\submission_screens"

"D:\Download\npx.cmd" -p playwright playwright screenshot --browser chromium --color-scheme dark --lang zh-CN --viewport-size "1600,1200" --wait-for-selector "#clusterCards .cluster-card" --wait-for-timeout 2200 "http://127.0.0.1:8765" "output\submission_screens\home-top.png"
if errorlevel 1 goto :fail

"D:\Download\npx.cmd" -p playwright playwright screenshot --browser chromium --color-scheme dark --lang zh-CN --viewport-size "1600,1200" --wait-for-selector "#trackedArticles .article-card" --wait-for-timeout 2600 --full-page "http://127.0.0.1:8765" "output\submission_screens\home-full.png"
if errorlevel 1 goto :fail

"D:\Download\npx.cmd" -p playwright playwright screenshot --browser chromium --color-scheme dark --lang zh-CN --viewport-size "1600,1200" --wait-for-selector ".detail-hero" --wait-for-timeout 2200 --full-page "http://127.0.0.1:8765/topic.html?cluster=0" "output\submission_screens\topic-detail.png"
if errorlevel 1 goto :fail

"D:\Download\npx.cmd" -p playwright playwright screenshot --browser chromium --color-scheme dark --lang zh-CN --viewport-size "1600,1200" --wait-for-selector ".detail-hero" --wait-for-timeout 2200 --full-page "http://127.0.0.1:8765/article.html?id=follow-energy-001" "output\submission_screens\article-detail.png"
if errorlevel 1 goto :fail

"D:\Download\npx.cmd" -p playwright playwright screenshot --browser chromium --color-scheme dark --lang zh-CN --viewport-size "1600,1200" --wait-for-selector ".detail-hero" --wait-for-timeout 2200 --full-page "http://127.0.0.1:8765/source.html?source=climate-desk" "output\submission_screens\source-detail.png"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:fail
set "EXIT_CODE=%ERRORLEVEL%"

:done
popd
exit /b %EXIT_CODE%
