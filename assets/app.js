/* 问问调解平台 DEMO - 公共脚本：侧边栏注入、标签切换、mock 交互 */
(function () {
  var ADMIN_MENU = [
    { group: '监控' },
    { id: 'dash', label: '调解驾驶舱', href: 'admin.html' },
    { id: 'overview', label: '数据概览', href: 'admin-courts.html' },
    { group: '案件' },
    { id: 'cases', label: '案件管理', href: 'admin-cases.html' },
    { id: 'casedetail', label: '案件详情', href: 'admin-case-detail.html', hiddenFromMenu: true },
    { id: 'assign', label: '智能分案', href: 'admin-assign.html' },
    { id: 'returns', label: '退案管理', href: 'admin-returns.html' },
    { group: '人员与机构' },
    { id: 'people', label: '人员管理', href: 'admin-people.html' },
    { id: 'base', label: '基础数据', href: 'admin-base.html' },
    { group: '费用' },
    { id: 'fees', label: '调解费报表', href: 'admin-fees.html' },
    { group: '配置' },
    { id: 'rules', label: '系统设置', href: 'admin-rules.html' },
    { id: 'logs', label: '操作日志', href: 'admin-logs.html' },
    { id: 'ai', label: 'AI报表', href: '#', disabled: true, tag: '后续' }
  ];
  var OPS_MENU = [
    { group: '工作台' },
    { id: 'workbench', label: '调解工作台', href: 'ops.html' },
    { id: 'todo', label: '待办事项', href: 'ops-todo.html' },
    { group: '案件' },
    { id: 'mycases', label: '我的案件', href: 'ops-cases.html' },
    { id: 'casedetail', label: '案件详情', href: 'ops-case-detail.html', hiddenFromMenu: true },
    { id: 'board', label: '调解进度看板', href: 'ops-board.html' },
    { id: 'schedule', label: '调解排期日历', href: 'ops-schedule.html' },
    { group: '办案工具' },
    { id: 'calls', label: '外呼记录', href: 'ops-calls.html' },
    { id: 'docs', label: '文书管理', href: 'ops-docs.html' },
    { group: '主管专属（带主管标识）' },
    { id: 'panorama', label: '法院数据全景', href: 'ops-panorama.html' }
  ];

  function buildSidebar() {
    var body = document.body;
    var endpoint = body.getAttribute('data-endpoint');
    var active = body.getAttribute('data-page');
    if (!endpoint) return;
    var menus = endpoint === 'admin' ? ADMIN_MENU : OPS_MENU;
    var userName = endpoint === 'admin' ? '系统管理员 · 王管理' : (body.getAttribute('data-supervisor') === 'true' ? '调解员（主管标识）· 张主管' : '调解员 · 李调解');
    var html = '<aside class="sidebar"><div class="logo">⚖ 问问调解平台<small>' + (endpoint === 'admin' ? '管理端 · 设置层（演示）' : '操作端 · 调解员（演示）') + '</small></div>';
    menus.forEach(function (m) {
      if (m.hiddenFromMenu) return;
      if (m.group) { html += '<div class="group-title">' + m.group + '</div>'; return; }
      var cls = 'menu-item' + (m.id === active ? ' active' : '') + (m.disabled ? ' disabled' : '');
      html += '<a class="' + cls + '" href="' + m.href + '">' + m.label + (m.tag ? '<span class="tag">' + m.tag + '</span>' : '') + '</a>';
    });
    html += '<div style="padding:16px 20px;margin-top:30px"><a href="index.html" style="font-size:12px;color:#8fa3d0">← 退出 / 切换角色</a></div></aside>';
    body.insertAdjacentHTML('afterbegin', html);

    var crumb = document.querySelector('.topbar .crumb');
    if (crumb) {
      var cur = menus.filter(function (m) { return m.id === active; })[0];
      if (cur) crumb.textContent = (endpoint === 'admin' ? '管理端' : '操作端') + ' / ' + cur.label;
    }
    var user = document.querySelector('.topbar .user');
    if (user) user.innerHTML = '<span style="font-size:13px">' + userName + '</span><span class="avatar">' + userName.split('·')[0].trim().slice(0, 1) + '</span>';
  }

  /* 标签页切换 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('tab')) {
      var wrap = t.closest('.tabs');
      wrap.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      var idx = Array.prototype.indexOf.call(wrap.children, t);
      var panels = document.querySelectorAll('[data-tab-panel]');
      panels.forEach(function (p, i) { p.style.display = (i === idx ? '' : 'none'); });
    }
    /* AI 面板开合 */
    if (t.id === 'ai-toggle' || t.closest && t.closest('#ai-toggle')) {
      document.getElementById('ai-panel').classList.toggle('open');
    }
    if (t.id === 'ai-close') document.getElementById('ai-panel').classList.remove('open');
    /* AI 快捷按钮 mock */
    if (t.classList && t.classList.contains('ai-quick-btn')) {
      var box = document.getElementById('ai-msgs');
      if (box) {
        box.insertAdjacentHTML('beforeend', '<div class="ai-msg user">' + t.textContent + '（案件 FL2026090001）</div>');
        setTimeout(function () {
          box.insertAdjacentHTML('beforeend', '<div class="ai-msg">【AI 演示输出】已基于当前案件数据（案情分析、调解记录 3 条）生成结果……<br>1. 争议焦点：借款本金 5 万元及利息计算方式；<br>2. 建议：围绕利息减免区间引导双方各让一步。<br><span style="color:#ad6800">⚠ AI生成内容仅供办案参考，正式文书请人工核对修正</span><br><br><button class="btn sm primary" onclick="alert(\'演示：已回填到表单\')">一键回填表单</button></div>');
          box.scrollTop = box.scrollHeight;
        }, 500);
      }
    }
    /* 通用演示按钮 */
    if (t.classList && t.classList.contains('demo-btn')) {
      e.preventDefault();
      alert('演示原型：该操作仅为交互示意，' + (t.getAttribute('data-msg') || '不产生实际数据变更') + '。');
    }
  });

  document.addEventListener('DOMContentLoaded', buildSidebar);
})();
