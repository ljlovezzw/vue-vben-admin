const decisions: Record<string, string> = {
  pending: '撤销判断',
  adopt: '采纳建议',
  modify: '修改后采纳',
  observe: '继续观察',
  ignore: '忽略建议',
  retain: '保留现状',
};

export function taskDecisionLabel(value?: null | string) {
  return value ? decisions[value] || value : '尚未判断';
}
