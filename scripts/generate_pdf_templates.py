from pathlib import Path
import shutil
import os

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'plugin' / 'pdf-templates'
PUBLIC = ROOT / 'docs' / 'pdf-templates'
OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
FONT = os.environ.get('PDF_TEMPLATE_FONT', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
pdfmetrics.registerFont(TTFont('Report', FONT))
INK, MUTED, BLUE = '#202B3C', '#697589', '#315DF5'
LINE, SOFT = '#E1E6EE', '#F3F5F9'


class Page:
    def __init__(self, name, label, size):
        self.path = OUTPUT / (name + '.pdf')
        self.label = label
        self.w, self.h = size
        self.pdf = canvas.Canvas(str(self.path), pagesize=size, pageCompression=1)
        self.pdf.setTitle(label + ' - PDF 版式模板')
        self.pdf.setAuthor('GTM Research')

    def box(self, x, y, w, h, fill=SOFT, stroke=None, radius=0):
        self.pdf.setFillColor(HexColor(fill))
        self.pdf.setStrokeColor(HexColor(stroke or fill))
        self.pdf.roundRect(x, self.h-y-h, w, h, radius, fill=1, stroke=bool(stroke))

    def line(self, x, y, w, color=LINE):
        self.pdf.setStrokeColor(HexColor(color))
        self.pdf.setLineWidth(.7)
        self.pdf.line(x, self.h-y, x+w, self.h-y)

    def text(self, x, y, text, size=11, color=INK):
        assert 0 <= x < self.w and 0 < y < self.h, (self.label, x, y, text)
        self.pdf.setFillColor(HexColor(color))
        self.pdf.setFont('Report', size)
        self.pdf.drawString(x, self.h-y, text)

    def paragraph(self, x, y, text, width, size=11, leading=None):
        leading = leading or size*1.6
        row = ''
        for char in text:
            if char == '\n' or pdfmetrics.stringWidth(row+char, 'Report', size) > width:
                self.text(x, y, row, size, MUTED)
                row = '' if char == '\n' else char
                y += leading
            else:
                row += char
        if row:
            self.text(x, y, row, size, MUTED)
            y += leading
        return y

    def footer(self, page):
        self.line(36, self.h-43, self.w-72)
        self.text(36, self.h-25, '版式参考 · 请替换全部占位内容', 8, MUTED)
        self.text(self.w-65, self.h-25, f'{page:02d}', 9, MUTED)

    def next(self, page):
        self.footer(page)
        self.pdf.showPage()

    def save(self, page):
        self.footer(page)
        self.pdf.save()
        shutil.copyfile(self.path, PUBLIC / self.path.name)


def heading(p, title, subtitle, margin=42, size=27):
    p.box(margin, 35, 25, 3, BLUE)
    p.text(margin, 70, p.label + ' / 研究报告', 9, MUTED)
    p.text(margin, 112, title, size)
    p.text(margin, 140, subtitle, 10, MUTED)


def finding(p, x, y, width, number, height=132, size=11):
    p.box(x, y, width, height, '#FFFFFF', LINE, 6)
    p.text(x+14, y+25, number, 11, BLUE)
    p.text(x+14, y+52, '[关键发现]', size+1)
    p.paragraph(x+14, y+75, '[用简短文字说明发现、适用范围与证据，保留来源编号。]', width-28, size)


def evidence_table(p, x, y, widths, rows, height=64, size=10):
    headers = ['编号', '证据与发现', '判断或影响', '来源与置信度']
    p.box(x, y, sum(widths), 30, '#EAF0FF')
    cursor = x
    for label, width in zip(headers, widths):
        p.text(cursor+10, y+20, label, size, INK)
        cursor += width
    y += 30
    for index in range(rows):
        p.box(x, y, sum(widths), height, '#FFFFFF' if index % 2 else '#F7F9FC')
        cursor = x
        cells = [f'S{index+1:02d}', '[记录原文、时间与实际发现]', '[区分原文事实与分析判断]', '[原文链接]\n[置信度与理由]']
        for cell, width in zip(cells, widths):
            bottom = p.paragraph(cursor+10, y+21, cell, width-20, size, size*1.5)
            assert bottom < y+height, (p.label, cell)
            cursor += width
        p.line(x, y+height, sum(widths))
        y += height
    return y


def clean():
    p = Page('clean', 'A 简洁报告', A4)
    m, width = 42, p.w-84
    heading(p, '[研究主题] 研究报告', '[研究范围]    /    [研究日期]    /    [样本数量]')
    p.box(m, 167, width, 78, '#EEF2FF', radius=7)
    p.text(m+16, 190, '一句话结论', 10, BLUE)
    p.paragraph(m+16, 217, '[先给出最重要的结论，以及它对下一步决策的影响。]', width-32, 13)
    p.text(m, 281, '01  关键发现', 13)
    w = (width-24)/3
    for i in range(3):
        finding(p, m+i*(w+12), 300, w, f'0{i+1}', 154, 10)
    p.text(m, 493, '02  建议下一步', 13)
    for i in range(3):
        y = 519+i*49
        p.text(m, y, f'0{i+1}', 10, BLUE)
        p.paragraph(m+31, y, '[建议行动]  [优先级]  [负责人或待确认信息]', width-31, 11)
        p.line(m+31, y+21, width-31)
    p.box(m, 677, width, 75, SOFT, radius=6)
    p.text(m+14, 699, '研究边界', 10)
    p.paragraph(m+14, 720, '[说明覆盖范围、未读取内容和结论限制；缺少的证据标为待确认。]', width-28, 10)
    p.next(1)
    heading(p, '证据明细与来源', '结论需要能回到原始记录。')
    bottom = evidence_table(p, m, 175, [44, 172, 153, width-369], 4, 77, 9)
    p.text(m, bottom+42, '03  来源与核对', 13)
    p.paragraph(m, bottom+68, '[按来源编号填写标题、链接、采集时间与适用范围。]\n[报告中的每个关键结论应引用对应来源，不能把占位内容当作证据。]', width, 11)
    p.save(2)


def presentation():
    p = Page('presentation', 'B 汇报演示', (960, 540))
    m, width = 46, 868
    p.text(m, 43, '研究简报 / [研究范围与日期]', 13, MUTED)
    p.text(m, 106, '[研究主题]：最重要的发现', 34)
    p.box(m, 134, width, 73, '#EEF2FF', radius=8)
    p.text(m+20, 179, '[用一句话说清结论与决策意义]', 23, BLUE)
    w = (width-32)/3
    for i in range(3):
        finding(p, m+i*(w+16), 232, w, f'0{i+1}', 179, 14)
    p.text(m, 455, '下一步  /  [优先行动]  ·  [负责人]  ·  [时间]', 15)
    p.next(1)
    p.text(m, 49, '证据与行动 / [研究主题]', 13, MUTED)
    p.text(m, 102, '把结论落到可核对的证据', 30)
    bottom = evidence_table(p, m, 136, [70, 298, 290, 210], 2, 91, 14)
    p.text(m, bottom+44, '待验证的问题', 19)
    p.paragraph(m, bottom+75, '[列出缺少证据的问题、验证方法与下一次应检查的内容。]', width, 15)
    p.save(2)


def data():
    p = Page('data', 'C 数据对照', landscape(A4))
    m, width = 36, p.w-72
    p.text(m, 40, '研究数据简报 / [主题]', 10, MUTED)
    p.text(m, 84, '对照矩阵与证据记录', 27)
    p.text(m, 111, '[研究范围]   /   [样本数量]   /   [日期]   /   [筛选规则]', 10, MUTED)
    evidence_table(p, m, 142, [48, 250, 240, width-538], 4, 76, 10)
    p.text(m, 514, '阅读说明', 10, BLUE)
    p.text(m+62, 514, '[频次仅代表本次样本；原文观点、推测与缺失信息分开标注。]', 10, MUTED)
    p.next(1)
    p.text(m, 43, '研究数据简报 / 结论与行动', 10, MUTED)
    p.text(m, 87, '从对照中提炼下一步', 26)
    w = (width-24)/3
    for i in range(3):
        finding(p, m+i*(w+12), 121, w, f'0{i+1}', 142, 11)
    p.text(m, 303, '行动清单', 13)
    evidence_table(p, m, 322, [48, 250, 240, width-538], 2, 69, 10)
    p.text(m, 523, '[补充来源、未完成范围与验证标准；正文超过此页时续页。]', 10, MUTED)
    p.save(2)


def editorial():
    p = Page('editorial', 'D 阅读简报', A4)
    m, width = 50, p.w-100
    p.text(m, 52, '研究观察 / [日期]', 10, BLUE)
    p.line(m, 74, width)
    p.text(m, 129, '[研究主题]', 33)
    p.text(m, 160, '从一条发现，理解它背后的问题。', 13, MUTED)
    p.paragraph(m, 209, '[导语：用一个完整段落交代研究范围、最重要的发现及其意义。读者无需先看表格，也能理解这份报告希望解决什么问题。]', width, 13, 22)
    p.box(m, 323, width, 104, SOFT, radius=4)
    p.box(m, 323, 3, 104, BLUE)
    p.text(m+20, 351, '一条值得关注的原话', 10, BLUE)
    p.paragraph(m+20, 381, '[放入真实原文或明确标记的摘要，附来源编号。]', width-40, 14)
    p.text(m, 474, '01  发生了什么', 14)
    p.paragraph(m, 503, '[围绕实际证据描述发现，说明出现在哪类人群或场景，区分一次性反馈与反复出现的信号。不要用没有证据的推测填满版面。]', width, 11, 19)
    p.text(m, 622, '02  为什么值得关注', 14)
    p.paragraph(m, 651, '[解释可能的影响、替代解释与还需要验证的内容，引用对应来源。]', width, 11, 19)
    p.next(1)
    p.text(m, 52, '研究观察 / 证据与下一步', 10, BLUE)
    p.line(m, 74, width)
    p.text(m, 122, '让分析可以继续被验证', 24)
    p.text(m, 169, '03  证据摘要', 14)
    for i in range(3):
        y = 204+i*92
        p.text(m, y, f'S{i+1:02d}', 10, BLUE)
        p.paragraph(m+39, y, '[证据标题与简要说明。保留原文链接、时间与范围，让读者可以回到来源核对。]', width-39, 11, 18)
        p.line(m+39, y+58, width-39)
    p.text(m, 511, '04  下一步行动', 14)
    p.paragraph(m, 544, '[写清优先行动、验证标准、负责人和时间；缺少承诺或证据时明确标记待确认。]', width, 11, 19)
    p.text(m, 645, '研究边界与来源', 12)
    p.paragraph(m, 675, '[补充未读取内容、样本限制与完整来源列表。页面按实际内容增加，不以版式为由删除证据。]', width, 10, 17)
    p.save(2)


if __name__ == '__main__':
    for build in [clean, presentation, data, editorial]:
        build()
    print(OUTPUT)
