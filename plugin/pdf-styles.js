export const PDF_STYLES=[
  {id:'clean',name:'简洁报告',caption:'A4 竖版 · 结论先行',file:'clean.pdf',instructions:'A4 竖版，浅灰底、深色文字、少量蓝色；页边距约 18mm，正文 10–11pt。首页按研究范围、三项关键发现、下一步排列，后续页放证据明细、限制和来源。标题克制，表格跨页重复表头。'},
  {id:'presentation',name:'汇报演示',caption:'16:9 横版 · 一页一个重点',file:'presentation.pdf',instructions:'16:9 横版，每页一个重点，正文不小于 14pt。使用简短结论、三栏发现卡片和下一步行动；证据表与来源另起页。保留完整研究结论和证据，按内容增加页面，不把所有内容挤进一页。'},
  {id:'data',name:'数据对照',caption:'A4 横版 · 表格与证据',file:'data.pdf',instructions:'A4 横版，正文 9–10pt，使用清晰表格。先展示范围与关键结论，再给对照矩阵、逐项证据和行动清单；表头蓝灰色，交替行底色。列宽按内容调整，长文本换行，跨页重复表头，不缩小到难以阅读。'},
  {id:'editorial',name:'阅读简报',caption:'A4 竖版 · 清晰叙述',file:'editorial.pdf',instructions:'A4 竖版，以清晰叙述为主，正文 10–11pt，约 1.6 倍行距。使用短标题、结论导语、完整分析段落和少量引文卡片；附证据、限制与行动清单。深色文字、细分隔线、少量蓝色，避免大面积色块。'}
];

export function resolvePdfStyle(id='clean'){
  if(id==='custom')return {id:'custom',name:'上传的 PDF 模板',instructions:'以用户上传的 PDF 为版式参考，在副本中生成结果，不覆盖原附件。'};
  const style=PDF_STYLES.find(style=>style.id===id);
  if(!style)throw new Error('请选择有效的 PDF 报告版式。');
  return style;
}
