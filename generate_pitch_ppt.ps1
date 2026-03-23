$ErrorActionPreference = 'Stop'

function New-RgbColor([int]$r, [int]$g, [int]$b) {
    return ($r -bor ($g -shl 8) -bor ($b -shl 16))
}

function Set-TextStyle($shape, [string]$fontName, [int]$fontSize, [int]$fontColor, [bool]$bold = $false) {
    $range = $shape.TextFrame.TextRange
    $range.Font.Name = $fontName
    $range.Font.Size = $fontSize
    $range.Font.Color.RGB = $fontColor
    $range.Font.Bold = [int]$bold
}

function Add-TextBox($slide, [single]$left, [single]$top, [single]$width, [single]$height, [string]$text) {
    $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
    $shape.TextFrame.TextRange.Text = $text
    $shape.TextFrame.WordWrap = -1
    return $shape
}

function Add-Rect($slide, [single]$left, [single]$top, [single]$width, [single]$height, [int]$fillColor) {
    $shape = $slide.Shapes.AddShape(1, $left, $top, $width, $height)
    $shape.Fill.Visible = -1
    $shape.Fill.Solid()
    $shape.Fill.ForeColor.RGB = $fillColor
    $shape.Line.Visible = 0
    return $shape
}

function Add-Line($slide, [single]$left, [single]$top, [single]$width, [single]$height, [int]$fillColor) {
    return Add-Rect $slide $left $top $width $height $fillColor
}

$outputPath = Join-Path (Get-Location) '游乡记_比赛路演版.pptx'

$cDark = New-RgbColor 33 43 56
$cPrimary = New-RgbColor 38 114 91
$cPrimaryLight = New-RgbColor 223 242 234
$cAccent = New-RgbColor 226 164 47
$cText = New-RgbColor 45 45 45
$cMuted = New-RgbColor 103 117 127
$cBg = New-RgbColor 248 246 240
$cWhite = New-RgbColor 255 255 255

$pp = $null
$presentation = $null

try {
    $pp = New-Object -ComObject PowerPoint.Application
    $pp.Visible = -1
    $presentation = $pp.Presentations.Add()
    $presentation.PageSetup.SlideWidth = 960
    $presentation.PageSetup.SlideHeight = 540

    function New-BaseSlide([string]$title, [string]$tagline = '') {
        $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
        Add-Rect $slide 0 0 960 540 $cBg | Out-Null
        Add-Line $slide 0 0 960 18 $cPrimary | Out-Null

        $titleShape = Add-TextBox $slide 48 36 620 48 $title
        Set-TextStyle $titleShape 'Microsoft YaHei UI' 24 $cDark $true

        if ($tagline) {
            $tagShape = Add-TextBox $slide 48 84 760 26 $tagline
            Set-TextStyle $tagShape 'Microsoft YaHei UI' 11 $cMuted $false
        }

        return $slide
    }

    function Add-BodyText($slide, [single]$left, [single]$top, [single]$width, [single]$height, [string[]]$lines) {
        $shape = Add-TextBox $slide $left $top $width $height ($lines -join "`r`n")
        Set-TextStyle $shape 'Microsoft YaHei UI' 16 $cText $false
        $shape.TextFrame.MarginLeft = 6
        $shape.TextFrame.MarginRight = 6
        for ($i = 1; $i -le $shape.TextFrame.TextRange.Paragraphs().Count; $i++) {
            $p = $shape.TextFrame.TextRange.Paragraphs($i)
            $p.ParagraphFormat.Bullet.Visible = -1
            $p.ParagraphFormat.Bullet.Character = 8226
            $p.ParagraphFormat.SpaceAfter = 5
        }
        return $shape
    }

    function Add-Card($slide, [single]$left, [single]$top, [single]$width, [single]$height, [string]$title, [string[]]$lines, [int]$fill = $cWhite) {
        Add-Rect $slide $left $top $width $height $fill | Out-Null
        $titleBox = Add-TextBox $slide ($left + 18) ($top + 16) ($width - 36) 28 $title
        Set-TextStyle $titleBox 'Microsoft YaHei UI' 18 $cPrimary $true
        $body = Add-BodyText $slide ($left + 12) ($top + 52) ($width - 24) ($height - 64) $lines
        $body.TextFrame.TextRange.Font.Size = 13
    }

    # Slide 1
    $s1 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    Add-Rect $s1 0 0 960 540 $cBg | Out-Null
    Add-Rect $s1 0 0 960 540 $cPrimaryLight | Out-Null
    Add-Rect $s1 0 0 400 540 $cPrimary | Out-Null
    Add-Rect $s1 400 0 560 540 $cBg | Out-Null
    Add-Line $s1 428 110 120 6 $cAccent | Out-Null
    $t1 = Add-TextBox $s1 62 150 280 60 '游乡记'
    Set-TextStyle $t1 'Microsoft YaHei UI' 30 $cWhite $true
    $t2 = Add-TextBox $s1 62 228 265 120 '用 AI 重构乡村旅游信息服务' + "`r`n" + '助力乡村文旅数字化升级'
    Set-TextStyle $t2 'Microsoft YaHei UI' 18 $cWhite $false
    $t3 = Add-TextBox $s1 430 148 420 72 '“游乡记”绘乡旅画，推进乡建现代化'
    Set-TextStyle $t3 'Microsoft YaHei UI' 26 $cDark $true
    $t4 = Add-TextBox $s1 430 250 360 90 '项目定位：乡村旅游智能导览与服务平台' + "`r`n" + '聚焦“发现难、决策难、转化难、运营难”四类核心问题'
    Set-TextStyle $t4 'Microsoft YaHei UI' 15 $cText $false
    $t5 = Add-TextBox $s1 430 420 360 38 '团队成员：余婧茹 / 王子博 / 梁语迪'
    Set-TextStyle $t5 'Microsoft YaHei UI' 12 $cMuted $false

    # Slide 2
    $s2 = New-BaseSlide '项目背景与机会' '乡村旅游快速增长，但乡村目的地的数字化服务仍然明显滞后'
    Add-Card $s2 48 130 260 290 '需求增长' @(
        '微度假、周边游、绿色消费持续升温'
        '乡村旅游逐渐成为城市居民高频休闲选择'
        '用户对低成本、短时长、强体验的出行需求上升'
    ) $cWhite
    Add-Card $s2 336 130 260 290 '供给分散' @(
        '大量乡村旅游资源分散在不同村镇和商户'
        '线上展示弱，优质内容难以被持续看见'
        '缺少适配乡村场景的统一连接入口'
    ) $cWhite
    Add-Card $s2 624 130 288 290 '窗口期出现' @(
        '数字化已成为乡村现代化的重要抓手'
        '文旅融合推动县域乡村服务升级'
        '机会不在“再做一个 OTA”，而在做乡村旅游的精准连接器'
    ) $cPrimaryLight

    # Slide 3
    $s3 = New-BaseSlide '核心痛点' '游客找不到，村镇接不住，现有平台也没有真正适配乡村旅游场景'
    Add-Card $s3 52 142 400 300 '游客端痛点' @(
        '信息分散在小红书、抖音、地图、OTA 等多个平台，搜索成本高'
        '攻略质量参差不齐，真假难辨，个性化不足'
        '乡村点位分散，小众目的地缺少可视化路线和串联推荐'
    ) $cWhite
    Add-Card $s3 504 142 400 300 '村镇端痛点' @(
        '乡村目的地缺少统一展示窗口和持续运营能力'
        '商户数字化基础弱，流量获取高度依赖平台分发'
        '文旅局、村镇、商户之间信息割裂，难形成统一服务'
    ) $cWhite
    $sum3 = Add-TextBox $s3 52 462 852 34 '结论：用户找不到可信攻略，村镇拿不到稳定流量，这正是游乡记的切入口。'
    Set-TextStyle $sum3 'Microsoft YaHei UI' 15 $cPrimary $true

    # Slide 4
    $s4 = New-BaseSlide '解决方案' '游乡记围绕“发现-决策-到访-分享”构建乡村旅游数字化闭环'
    Add-Card $s4 48 130 260 290 '游客端服务' @(
        '一站式乡旅攻略整合'
        '乡旅地图与打卡点亮'
        'AI 助手“小乡”智能问答和行程推荐'
        '门票、住宿、路线、评价等信息聚合查询'
    ) $cWhite
    Add-Card $s4 336 130 260 290 '村镇端服务' @(
        '乡村目的地数字化展示页'
        '商户接入与服务信息统一上架'
        '活动、路线、特色资源集中运营'
        '为地方文旅部门提供宣传与数据支持'
    ) $cWhite
    Add-Card $s4 624 130 288 290 '平台价值' @(
        '让用户从“到处查”变成“直接去”'
        '让村镇从“被动等流量”变成“主动被发现”'
        '形成游客、商户、村镇、文旅部门多方共赢'
    ) $cPrimaryLight

    # Slide 5
    $s5 = New-BaseSlide '产品功能展示' '三大核心模块，核心目标是降低决策成本并提升到访转化'
    Add-Card $s5 48 144 260 280 '乡旅地图' @(
        '可视化查看村镇分布和特色点位'
        '将分散目的地组织成可走、可逛、可分享的路线'
        '打卡点亮机制增强传播与复访'
    ) $cWhite
    Add-Card $s5 336 144 260 280 '一站式攻略' @(
        '聚合交通、住宿、美食、活动、评价等信息'
        '减少用户跨平台反复搜索和比较'
        '提高出行决策效率和信息可信度'
    ) $cWhite
    Add-Card $s5 624 144 288 280 'AI 助手“小乡”' @(
        '根据预算、时间、人数、偏好生成个性化行程'
        '提供实时问答、避坑提醒和路线建议'
        '降低制作攻略门槛，提升用户黏性'
    ) $cPrimaryLight

    # Slide 6
    $s6 = New-BaseSlide '竞争优势' '相比通用旅游平台，我们的优势来自场景聚焦、服务适配和落地路径'
    Add-Card $s6 48 130 200 290 '更聚焦' @(
        '专注乡村旅游场景'
        '不与综合 OTA 正面拼全量流量'
        '把资源集中在县域和乡村目的地'
    ) $cWhite
    Add-Card $s6 270 130 200 290 '更匹配' @(
        '围绕小众、分散、低标准化场景设计产品'
        '更适合家庭游、研学游、短途游'
        '更懂乡村旅游的决策链路'
    ) $cWhite
    Add-Card $s6 492 130 200 290 '更智能' @(
        'AI 降低攻略制作和行程规划门槛'
        '提升信息组织效率'
        '增强个性化体验'
    ) $cWhite
    Add-Card $s6 714 130 198 290 '更可落地' @(
        '先做县域试点，再复制到更多地区'
        '从真实合作场景切入'
        '避免先铺全国带来的高成本风险'
    ) $cPrimaryLight

    # Slide 7
    $s7 = New-BaseSlide '商业模式' '先跑通现金流，再放大平台价值，形成多元但轻资产的收入结构'
    Add-Card $s7 52 146 260 276 '政府合作' @(
        '与县级文旅局合作'
        '提供乡村文旅数字化展示与宣传服务'
        '作为项目早期最稳定的现金流入口'
    ) $cWhite
    Add-Card $s7 348 146 260 276 '商户服务' @(
        '对住宿、门票、餐饮、活动等交易收取服务佣金'
        '降低入驻门槛，帮助商户获得稳定曝光'
        '随着平台活跃度提升持续放大'
    ) $cWhite
    Add-Card $s7 644 146 260 276 '用户增值' @(
        '推出 AI 会员、行程定制、专题路线包'
        '通过个性化服务提升单客价值'
        '具备较高毛利和扩展空间'
    ) $cPrimaryLight
    $sum7 = Add-TextBox $s7 52 448 860 38 '成长期目标：形成“政府合作 + 商户佣金 + AI 增值”三轮驱动的百万元级营收模型。'
    Set-TextStyle $sum7 'Microsoft YaHei UI' 15 $cPrimary $true

    # Slide 8
    $s8 = New-BaseSlide '落地路径与发展规划' '不追求一开始做大，而是先验证一个县域模型，再低成本复制'
    Add-Card $s8 48 146 260 276 '第一阶段：试点验证' @(
        '选择 1 至 2 个县域乡旅资源集中的地区落地'
        '完成基础平台搭建与首批商户接入'
        '验证用户需求、服务流程和转化效果'
    ) $cWhite
    Add-Card $s8 336 146 260 276 '第二阶段：区域复制' @(
        '与更多乡镇、景区、民宿、农文旅项目合作'
        '形成标准化接入和运营方法'
        '打造区域样板案例'
    ) $cWhite
    Add-Card $s8 624 146 288 276 '第三阶段：全国扩展' @(
        '建立跨地区乡旅数据库'
        '沉淀用户、目的地和服务商资源'
        '打造全国性的乡村旅游智能服务平台'
    ) $cPrimaryLight

    # Slide 9
    $s9 = New-BaseSlide '团队与结语' '跨专业协作，把产品概念推进为可落地的乡旅数字服务方案'
    Add-Card $s9 52 142 380 260 '团队分工' @(
        '余婧茹：项目统筹、产品策划、路演推进'
        '王子博：技术开发、平台实现、功能落地'
        '梁语迪：界面设计、功能优化、用户体验支持'
        '后续计划补充文旅运营、视觉设计、市场推广人才'
    ) $cWhite
    Add-Card $s9 476 142 428 260 '结语' @(
        '游乡记不只是一个旅游工具'
        '而是一套服务乡村旅游数字化升级的连接方案'
        '让更多乡村被看见'
        '让更多游客愿意来、方便来、还想再来'
    ) $cPrimaryLight
    $thanks = Add-TextBox $s9 52 444 852 42 '谢谢各位评委老师聆听'
    Set-TextStyle $thanks 'Microsoft YaHei UI' 24 $cDark $true

    if (Test-Path $outputPath) {
        Remove-Item $outputPath -Force
    }

    $presentation.SaveAs($outputPath)
    $presentation.Close()
    $pp.Quit()

    Write-Output "CREATED: $outputPath"
}
catch {
    if ($presentation -ne $null) { try { $presentation.Close() } catch {} }
    if ($pp -ne $null) { try { $pp.Quit() } catch {} }
    throw
}
