/* 淘系二级指标监控总看板 · 渲染 + 导入自动匹配 */
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var deep = style.getPropertyValue('--deep').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  var charts = [];       // echarts 实例注册表
  var currentData = null;

  /* ---------- 格式化 ---------- */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  /* 宽容取数：支持文本型数字、千分位、百分号（20.84% → 0.2084） */
  function toNum(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v !== 'string') return null;
    var s = v.replace(/[,，\s￥¥]/g, '');
    if (!s || s === '/' || s === '—' || s === '-' || s === '−') return null;
    var pct = /%$/.test(s);
    s = s.replace(/%$/, '');
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return pct ? n / 100 : n;
  }
  function fmtInt(v) { return isNum(v) ? Math.round(v).toLocaleString('zh-CN') : '—'; }
  function fmtWan(v) { return isNum(v) ? (v / 10000 >= 10 ? (v / 10000).toFixed(0) : (v / 10000).toFixed(2)) + '万' : '—'; }
  function fmtPct(v) { return isNum(v) ? (v * 100).toFixed(1) + '%' : '—'; }
  function pct2(v) { return isNum(v) ? (v * 100).toFixed(2) + '%' : '—'; }
  function fmtDec(v, d) { return isNum(v) ? v.toLocaleString('zh-CN', { maximumFractionDigits: d == null ? 1 : d }) : '—'; }

  function teamLabel(t) { return t.name ? t.key + ' ' + t.name : t.key; }
  function groupColor(key) {
    if (key.charAt(0) === 'F') return accent2;
    if (key === '追单') return muted;
    return accent;
  }

  function baseGrid(extra) {
    return Object.assign({ left: 12, right: 18, top: 42, bottom: 8, containLabel: true }, extra || {});
  }
  function catAxis(labels, rotate) {
    return {
      type: 'category', data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 11, interval: 0, rotate: rotate || 0 }
    };
  }
  function valAxis(fmt) {
    return {
      type: 'value',
      axisLabel: { color: muted, fontSize: 11, formatter: fmt },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    };
  }
  var tooltipBase = { appendToBody: true, textStyle: { fontFamily: FONT, fontSize: 12 } };

  function makeChart(id, option) {
    var el = document.getElementById(id);
    if (!el) return;
    var inst = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: 'svg' });
    inst.setOption(option, true);
    if (charts.indexOf(inst) < 0) charts.push(inst);
  }

  /* ---------- 通用：从 section1 行取团队序列 ---------- */
  function teamSeries(rowObj, data, includeGroups) {
    var keys = data.teams.map(function (t) { return t.key; });
    if (includeGroups) keys = keys.concat(data.groups);
    return keys.map(function (k) { return rowObj && isNum(rowObj[k]) ? rowObj[k] : null; });
  }
  function teamLabels(data) {
    return data.teams.map(function (t) { return teamLabel(t); });
  }

  /* ================= KPI ================= */
  function renderKPI(data) {
    var s1 = data.section1;
    var total = function (m) { return s1[m] ? s1[m]['中心合计'] : null; };
    var cards = [
      { label: '销售额 · 中心合计', value: fmtWan(total('销售额')), foot: '综合组 ' + fmtWan(s1['销售额']['综合组']) + ' · 分品组 ' + fmtWan(s1['销售额']['分品组']) + ' · 追单 ' + fmtWan(s1['销售额']['追单']) },
      { label: '单流量 · 中心', value: fmtDec(total('单流量')), unit: '元', foot: '综合组 ' + fmtDec(s1['单流量']['综合组']) + ' · 分品组 ' + fmtDec(s1['单流量']['分品组']) },
      { label: '转化率 · 中心', value: pct2(total('转化率')), foot: '综合组 ' + pct2(s1['转化率']['综合组']) + ' · 分品组 ' + pct2(s1['转化率']['分品组']) },
      { label: '客单价 · 中心', value: fmtDec(total('客单价')), unit: '元', foot: '综合组 ' + fmtDec(s1['客单价']['综合组']) + ' · 分品组 ' + fmtDec(s1['客单价']['分品组']) },
      { label: '销售额占比 · 结构', value: fmtPct(s1['销售额占比']['综合组']), unit: '综合组', foot: '分品组 ' + fmtPct(s1['销售额占比']['分品组']) + ' · 追单 ' + fmtPct(s1['销售额占比']['追单']) }
    ];
    document.getElementById('kpiGrid').innerHTML = cards.map(function (c) {
      return '<div class="kpi"><div class="k-label"><span>' + c.label + '</span></div>' +
        '<div class="k-value">' + c.value + (c.unit ? '<small>' + c.unit + '</small>' : '') + '</div>' +
        '<div class="k-foot">' + c.foot + '</div></div>';
    }).join('');

    var s2 = data.section2;
    var vol = s2.coreVolume || {}, rate = s2.coreRate || {};
    var suiteTotal = 0;
    (s2.suiteVolume['中心'] || []).forEach(function (v) { if (isNum(v)) suiteTotal += v; });
    var cards2 = [
      { label: '核心品台量 · 中心合计', value: fmtInt(vol['中心合计']), unit: '台', foot: '接待口径 · 截止当期' },
      { label: '台量达成率 · 中心', value: fmtPct(rate['中心合计']), foot: '目标达成红线 = 100%' },
      { label: '多件套销售合计 · 中心', value: fmtInt(suiteTotal), unit: '台', foot: '三件套及以上累计' },
      { label: '监控型号数', value: (s2.models || []).length, unit: '个', foot: '核心品在架型号' }
    ];
    document.getElementById('kpiGrid2').innerHTML = cards2.map(function (c) {
      return '<div class="kpi"><div class="k-label"><span>' + c.label + '</span></div>' +
        '<div class="k-value">' + c.value + (c.unit ? '<small>' + c.unit + '</small>' : '') + '</div>' +
        '<div class="k-foot">' + c.foot + '</div></div>';
    }).join('');
  }

  /* ================= 01 经营结果类 ================= */
  function renderSection1(data) {
    var s1 = data.section1;
    var labels = teamLabels(data);
    var keys = data.teams.map(function (t) { return t.key; });

    /* 1. 销售额结构 donut */
    var pieVals = [
      { name: '综合组', value: s1['销售额']['综合组'], itemStyle: { color: accent } },
      { name: '分品组', value: s1['销售额']['分品组'], itemStyle: { color: accent2 } },
      { name: '追单', value: s1['销售额']['追单'], itemStyle: { color: muted } }
    ];
    makeChart('chart-sales-pie', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'item',
        formatter: function (p) { return p.name + '<br/>销售额：¥' + fmtWan(p.value) + '<br/>占比：' + p.percent.toFixed(1) + '%'; }
      }),
      legend: { bottom: 4, textStyle: { color: ink, fontSize: 12 }, itemWidth: 14, itemHeight: 9 },
      series: [{
        type: 'pie', radius: ['46%', '72%'], center: ['50%', '46%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: bg2, borderWidth: 3 },
        label: { color: ink, fontSize: 12, formatter: '{b}\n{d}%' },
        labelLine: { lineStyle: { color: rule } },
        data: pieVals
      }, {
        type: 'pie', radius: ['0%', '0%'], center: ['50%', '46%'], silent: true,
        label: {
          position: 'center', color: ink,
          formatter: '中心合计\n' + fmtWan(s1['销售额']['中心合计']),
          fontSize: 15, fontWeight: 700, lineHeight: 22
        },
        data: [{ value: 1, itemStyle: { color: 'transparent' } }]
      }]
    });

    /* 2. 销售额 + 占比 组合图 */
    var sales = teamSeries(s1['销售额'], data);
    var share = teamSeries(s1['销售额占比'], data);
    makeChart('chart-sales-bar', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return labels[i] + '<br/>销售额：¥' + fmtWan(sales[i]) + '<br/>组内占比：' + pct2(share[i]);
        }
      }),
      legend: { top: 4, textStyle: { color: ink, fontSize: 12 } },
      grid: baseGrid({ top: 46 }),
      xAxis: catAxis(labels, 32),
      yAxis: [valAxis(function (v) { return (v / 10000).toFixed(0) + '万'; }),
        Object.assign(valAxis(function (v) { return (v * 100).toFixed(0) + '%'; }), { splitLine: { show: false } })],
      series: [{
        name: '销售额', type: 'bar', data: sales.map(function (v, i) {
          return { value: v, itemStyle: { color: groupColor(keys[i]), borderRadius: [4, 4, 0, 0] } };
        }),
        barMaxWidth: 34,
        label: {
          show: true, position: 'top', distance: 3,
          fontSize: 10, fontWeight: 700, color: ink,
          formatter: function (p) { return fmtWan(p.value); }
        }
      }, {
        name: '组内占比', type: 'line', yAxisIndex: 1, data: share,
        symbol: 'circle', symbolSize: 7,
        lineStyle: { color: deep, width: 2 }, itemStyle: { color: deep },
        label: { show: true, position: 'top', fontSize: 10, color: deep, formatter: function (p) { return fmtPct(p.value); } }
      }]
    });

    /* 3-5. 单流量 / 转化率 / 客单价 通用柱图（转化率、客单价剔除追单组） */
    function simpleBar(id, metric, axisFmt, tipFmt, markVal, markName, excludeKeys) {
      var row = s1[metric] || {};
      var idxs = [];
      keys.forEach(function (k, i) {
        if (excludeKeys && excludeKeys.indexOf(k) >= 0) return;
        idxs.push(i);
      });
      var labs = idxs.map(function (i) { return labels[i]; });
      var vals = idxs.map(function (i) { return isNum(row[keys[i]]) ? row[keys[i]] : null; });
      var opt = {
        animation: false, textStyle: { fontFamily: FONT },
        tooltip: Object.assign({}, tooltipBase, {
          trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: function (ps) {
            var i = ps[0].dataIndex;
            return labs[i] + '<br/>' + metric + '：' + tipFmt(vals[i]);
          }
        }),
        grid: baseGrid({ top: 40 }),
        xAxis: catAxis(labs, 38),
        yAxis: valAxis(axisFmt),
        series: [{
          type: 'bar', barMaxWidth: 34,
          label: {
            show: true, position: 'top', fontSize: 10.5, fontWeight: 700, color: ink,
            formatter: function (p) { return tipFmt(p.value); }
          },
          data: vals.map(function (v, i) {
            return { value: v, itemStyle: { color: groupColor(keys[idxs[i]]), borderRadius: [4, 4, 0, 0] } };
          })
        }]
      };
      if (isNum(markVal)) {
        opt.series[0].markLine = {
          symbol: 'none', silent: true,
          lineStyle: { color: deep, type: 'dashed', width: 1.5 },
          label: { color: deep, fontSize: 10, formatter: markName + ' ' + tipFmt(markVal) },
          data: [{ yAxis: markVal }]
        };
      }
      makeChart(id, opt);
    }
    simpleBar('chart-flow', '单流量', function (v) { return v >= 10000 ? (v / 10000).toFixed(1) + 'w' : v.toFixed(0); },
      function (v) { return fmtDec(v) + ' 元'; }, s1['单流量']['中心合计'], '中心', ['追单']);
    simpleBar('chart-conv', '转化率', function (v) { return (v * 100).toFixed(0) + '%'; },
      function (v) { return pct2(v); }, s1['转化率']['中心合计'], '中心', ['追单']);
    simpleBar('chart-avv', '客单价', function (v) { return (v / 1000).toFixed(1) + 'k'; },
      function (v) { return fmtDec(v) + ' 元'; }, s1['客单价']['中心合计'], '中心', ['追单']);

    /* 6. 监控·接待/询单率 */
    var rec = s1['监控·接待/询单率'] || {};
    var recVals = keys.map(function (k) { return isNum(rec[k]) ? rec[k] : null; });
    makeChart('chart-reception', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return labels[i] + '<br/>接待/询单率：' + fmtDec(recVals[i]);
        }
      }),
      grid: baseGrid({ top: 30 }),
      xAxis: catAxis(labels, 0),
      yAxis: valAxis(function (v) { return v.toFixed(0); }),
      series: [{
        type: 'bar', barMaxWidth: 46,
        label: { show: true, position: 'top', fontSize: 10.5, color: ink, formatter: function (p) { return fmtDec(p.value); } },
        data: recVals.map(function (v, i) {
          return { value: v, itemStyle: { color: groupColor(keys[i]), borderRadius: [5, 5, 0, 0] } };
        })
      }]
    });

    /* 明细表 */
    var metrics = ['销售额', '销售额占比', '单流量', '转化率', '客单价', '监控·接待/询单率'];
    var fmtMap = { '销售额': fmtWan, '销售额占比': pct2, '单流量': fmtDec, '转化率': pct2, '客单价': fmtDec, '监控·接待/询单率': fmtDec };
    var cols = data.teams.map(function (t) { return { k: t.key, n: teamLabel(t) }; })
      .concat(data.groups.map(function (g) { return { k: g, n: g }; }));
    var html = '<thead><tr><th>二级/监控指标</th>' + cols.map(function (c) { return '<th>' + c.n + '</th>'; }).join('') + '</tr></thead><tbody>';
    metrics.forEach(function (m) {
      html += '<tr><td>' + m + '</td>' + cols.map(function (c) {
        var v = s1[m] ? s1[m][c.k] : null;
        return editTd('section1', m, c.k, v, fmtMap[m]);
      }).join('') + '</tr>';
    });
    document.getElementById('table-sec1').innerHTML = html + '</tbody>';
  }

  /* ================= 02 品线结构类 ================= */
  function renderSection2(data) {
    var s2 = data.section2;
    s2.coreVolume = s2.coreVolume || {};
    s2.coreRate = s2.coreRate || {};
    s2.modelConv = s2.modelConv || {};
    s2.modelSales = s2.modelSales || {};
    var coreTeams = data.teams.filter(function (t) { return t.key !== '追单'; });
    var labels = coreTeams.map(function (t) { return teamLabel(t); });
    var keys = coreTeams.map(function (t) { return t.key; });

    /* 1. 核心品台量 */
    var vols = keys.map(function (k) { return s2.coreVolume && isNum(s2.coreVolume[k]) ? s2.coreVolume[k] : null; });
    makeChart('chart-core-vol', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return labels[i] + '<br/>核心品台量：' + fmtInt(vols[i]) + ' 台';
        }
      }),
      grid: baseGrid({ top: 30 }),
      xAxis: catAxis(labels, 32),
      yAxis: valAxis(function (v) { return v; }),
      series: [{
        type: 'bar', barMaxWidth: 34,
        label: { show: true, position: 'top', fontSize: 10.5, color: ink, formatter: function (p) { return fmtInt(p.value); } },
        data: vols.map(function (v, i) {
          return { value: v, itemStyle: { color: groupColor(keys[i]), borderRadius: [4, 4, 0, 0] } };
        }),
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: deep, type: 'dashed', width: 1.5 },
          label: { color: deep, fontSize: 10, formatter: '中心合计 ' + fmtInt(s2.coreVolume['中心合计']) },
          data: [{ yAxis: isNum(s2.coreVolume['中心合计']) ? s2.coreVolume['中心合计'] / Math.max(vols.length, 1) : 0 }]
        }
      }]
    });

    /* 2. 台量达成率 */
    var rates = keys.map(function (k) { return s2.coreRate && isNum(s2.coreRate[k]) ? s2.coreRate[k] : null; });
    makeChart('chart-core-rate', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return labels[i] + '<br/>台量达成率：' + pct2(rates[i]);
        }
      }),
      grid: baseGrid({ top: 30 }),
      xAxis: catAxis(labels, 32),
      yAxis: valAxis(function (v) { return (v * 100).toFixed(0) + '%'; }),
      series: [{
        type: 'bar', barMaxWidth: 34,
        label: { show: true, position: 'top', fontSize: 10.5, color: ink, formatter: function (p) { return fmtPct(p.value); } },
        data: rates.map(function (v, i) {
          var c = v >= 1 ? accent2 : (v >= 0.6 ? accent : deep);
          return { value: v, itemStyle: { color: c, borderRadius: [4, 4, 0, 0] } };
        }),
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: accent2, type: 'dashed', width: 1.8 },
          label: { color: accent2, fontSize: 10.5, formatter: '达成线 100%' },
          data: [{ yAxis: 1 }]
        }
      }]
    });

    /* 3. 分型号：台量 vs 目标 + 进度 */
    var models = s2.models || [];
    var mVol = models.map(function (m) { var d = s2.modelSales[m]; return d && isNum(d.volume) ? d.volume : null; });
    var mTgt = models.map(function (m) { var d = s2.modelSales[m]; return d && isNum(d.target) ? d.target : null; });
    var mProg = models.map(function (m) { var d = s2.modelSales[m]; return d && isNum(d.progress) ? d.progress : null; });
    makeChart('chart-model-vol', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return models[i] + '<br/>累计台量：' + fmtInt(mVol[i]) + ' 台<br/>月度目标：' + fmtInt(mTgt[i]) + ' 台<br/>月度进度：' + pct2(mProg[i]);
        }
      }),
      legend: { top: 2, textStyle: { color: ink, fontSize: 12 } },
      grid: baseGrid({ top: 48 }),
      xAxis: catAxis(models, 38),
      yAxis: [valAxis(function (v) { return v; }),
        Object.assign(valAxis(function (v) { return (v * 100).toFixed(0) + '%'; }), { splitLine: { show: false } })],
      series: [{
        name: '累计台量', type: 'bar', data: mVol, barMaxWidth: 16,
        itemStyle: { color: accent, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 9, color: accent, formatter: function (p) { return fmtInt(p.value); } }
      }, {
        name: '月度目标', type: 'bar', data: mTgt, barMaxWidth: 16,
        itemStyle: { color: accent2 + '55', borderColor: accent2, borderWidth: 1.5, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 9, fontWeight: 600, color: accent2, formatter: function (p) { return isNum(p.value) ? fmtInt(p.value) : ''; } }
      }, {
        name: '月度进度', type: 'line', yAxisIndex: 1, data: mProg,
        symbol: 'circle', symbolSize: 6,
        lineStyle: { color: deep, width: 2 }, itemStyle: { color: deep },
        label: { show: true, position: 'bottom', fontSize: 9, color: deep, formatter: function (p) { return fmtPct(p.value); } },
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: accent2, type: 'dashed', width: 1.5 },
          label: { color: accent2, fontSize: 10, formatter: '100%' },
          data: [{ yAxis: 1 }]
        }
      }]
    });

    /* 4. 分型号咨询转化率（降序） */
    var convArr = models.map(function (m) {
      return { m: m, v: isNum(s2.modelConv[m]) ? s2.modelConv[m] : null };
    }).sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
    var avgConv = 0, cnt = 0;
    convArr.forEach(function (d) { if (isNum(d.v)) { avgConv += d.v; cnt++; } });
    avgConv = cnt ? avgConv / cnt : 0;
    makeChart('chart-model-conv', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return convArr[i].m + '<br/>咨询转化率：' + pct2(convArr[i].v);
        }
      }),
      grid: baseGrid({ top: 30 }),
      xAxis: catAxis(convArr.map(function (d) { return d.m; }), 38),
      yAxis: valAxis(function (v) { return (v * 100).toFixed(0) + '%'; }),
      series: [{
        type: 'bar', barMaxWidth: 26,
        label: { show: true, position: 'top', fontSize: 10, color: ink, formatter: function (p) { return fmtPct(p.value); } },
        data: convArr.map(function (d) {
          return { value: d.v, itemStyle: { color: d.v >= avgConv ? accent : accent2, borderRadius: [4, 4, 0, 0] } };
        }),
        markLine: {
          symbol: 'none', silent: true,
          lineStyle: { color: deep, type: 'dashed', width: 1.5 },
          label: { color: deep, fontSize: 10, formatter: '均值 ' + fmtPct(avgConv) },
          data: [{ yAxis: avgConv }]
        }
      }]
    });

    /* 5. 分品线套系销售量（堆叠） */
    var cats = s2.suiteCats || [];
    var lines = ['中心', '综合组', '分品组'];
    var catColors = [accent, accent2, accent + '88', muted];
    makeChart('chart-suite-vol', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var t = ps[0].name + '<br/>';
          var total = 0;
          ps.forEach(function (p) { if (isNum(p.value)) total += p.value; });
          ps.forEach(function (p) { t += p.marker + p.seriesName + '：' + fmtInt(p.value) + ' 台<br/>'; });
          return t + '<b>合计：' + fmtInt(total) + ' 台</b>';
        }
      }),
      legend: { top: 2, textStyle: { color: ink, fontSize: 12 } },
      grid: baseGrid({ top: 46 }),
      xAxis: catAxis(lines, 0),
      yAxis: valAxis(function (v) { return v; }),
      series: cats.map(function (c, i) {
        return {
          name: c, type: 'bar', stack: 'suite', barMaxWidth: 60,
          itemStyle: { color: catColors[i % catColors.length] },
          label: {
            show: true, fontSize: 11, fontWeight: 700, color: '#FFF',
            textBorderColor: 'rgba(43,26,23,0.55)', textBorderWidth: 2.5,
            formatter: function (p) { return p.value > 0 ? fmtInt(p.value) : ''; }
          },
          data: lines.map(function (L) { return s2.suiteVolume[L] ? s2.suiteVolume[L][i] : null; })
        };
      })
    });

    /* 6. 套系销售占比（100% 堆叠横条） */
    var rateSeries = cats.map(function (c, i) {
      return {
        name: c, type: 'bar', stack: 'rate', barWidth: 46,
        itemStyle: { color: catColors[i % catColors.length] },
        label: {
          show: true, fontSize: 11, fontWeight: 700, color: '#FFF',
          textBorderColor: 'rgba(43,26,23,0.55)', textBorderWidth: 2.5,
          formatter: function (p) { return p.value >= 0.02 ? (p.value * 100).toFixed(1) + '%' : ''; }
        },
        data: lines.map(function (L) { return s2.suiteRate[L] ? s2.suiteRate[L][i] : null; })
      };
    });
    makeChart('chart-suite-rate', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var t = ps[0].name + '<br/>';
          ps.forEach(function (p) { t += p.marker + p.seriesName + '：' + pct2(p.value) + '<br/>'; });
          return t;
        }
      }),
      legend: { top: 2, textStyle: { color: ink, fontSize: 12 } },
      grid: baseGrid({ top: 46 }),
      xAxis: Object.assign(valAxis(function (v) { return (v * 100).toFixed(0) + '%'; }), { max: 1 }),
      yAxis: {
        type: 'category', data: lines,
        axisTick: { show: false }, axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 12 }
      },
      series: rateSeries
    });

    /* 型号明细表 */
    var html = '<thead><tr><th>核心品型号</th><th>累计台量（台）</th><th>月度目标（台）</th><th>月度进度</th><th>咨询转化率</th></tr></thead><tbody>';
    models.forEach(function (m) {
      var d = s2.modelSales[m] || {};
      html += '<tr><td>' + m + '</td>'
        + editTd('modelSales', m, '', d.volume, fmtInt, 'volume')
        + editTd('modelSales', m, '', d.target, fmtInt, 'target')
        + '<td>' + pct2(d.progress) + '</td>'
        + editTd('modelSales', m, '', s2.modelConv[m], pct2, 'conv');
    });
    document.getElementById('table-sec2').innerHTML = html + '</tbody>';
  }

  /* ================= 03-05 通用工具 ================= */
  /* ---------- 编辑模式 ---------- */
  var editMode = false;
  function editTd(sec, m, k, v, fmt, field) {
    var shown = isNum(v) ? fmt(v) : '—';
    var path = [sec, m, k, field || ''].join('\u0001').replace(/\u0001$/, '');
    if (!editMode) return '<td>' + shown + '</td>';
    return '<td contenteditable="true" spellcheck="false" data-edit="' + path + '">' + shown + '</td>';
  }
  function commitEdit(parts, txt) {
    var sec = parts[0], m = parts[1], k = parts[2], field = parts[3];
    if (sec === 'modelSales') {
      var d = currentData.section2.modelSales[m] = currentData.section2.modelSales[m] || {};
      var nv = toNum(txt);
      if (nv == null && txt !== '' && txt !== '—') { toast('请输入数字（台量/目标/转化率）', true); renderAll(currentData); return; }
      if (field === 'conv') {
        currentData.section2.modelConv[m] = nv;
        toast('已更新 ' + m + '（咨询转化率）');
        renderAll(currentData);
        return;
      }
      d[field] = nv;
      if (isNum(d.volume) && isNum(d.target) && d.target) d.progress = d.volume / d.target;
      toast('已更新 ' + m + '（' + (field === 'volume' ? '累计台量' : '月度目标') + '）');
      renderAll(currentData);
      return;
    }
    if (sec === 'issues') {
      currentData.issues[k] = txt;
      toast('已更新待改进问题（' + k + '）');
      renderAll(currentData);
      return;
    }
    var row = currentData[sec] && currentData[sec][m];
    if (!row) return;
    var nv2 = toNum(txt);
    if (nv2 == null && txt !== '' && txt !== '—') { toast('「' + txt + '」不是有效数值，已还原', true); renderAll(currentData); return; }
    row[k] = nv2;
    toast('已更新 ' + m + ' · ' + k + (nv2 == null ? ' → —' : ' → ' + txt));
    renderAll(currentData);
  }
  function setEditMode(on) {
    editMode = on;
    document.body.classList.toggle('edit-on', on);
    document.getElementById('btnEdit').textContent = on ? '完成编辑' : '编辑数据';
    document.getElementById('editHint').style.display = on ? 'inline' : 'none';
    if (currentData) renderAll(currentData);
  }

  function kpiCards(elId, cards) {
    document.getElementById(elId).innerHTML = cards.map(function (c) {
      return '<div class="kpi"><div class="k-label"><span>' + c.label + '</span></div>' +
        '<div class="k-value">' + c.value + (c.unit ? '<small>' + c.unit + '</small>' : '') + '</div>' +
        '<div class="k-foot">' + (c.foot || '') + '</div></div>';
    }).join('');
  }

  /* 通用团队柱图：exclude 排除指定组；dropNull 自动剔除无数据团队 */
  function teamBarEx(id, rowObj, cfg) {
    rowObj = rowObj || {};
    var ts = currentData.teams.filter(function (t) { return (cfg.exclude || []).indexOf(t.key) < 0; });
    if (cfg.dropNull !== false) ts = ts.filter(function (t) { return isNum(rowObj[t.key]); });
    var labs = ts.map(function (t) { return teamLabel(t); });
    var vals = ts.map(function (t) { return isNum(rowObj[t.key]) ? rowObj[t.key] : null; });
    var opt = {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) { var i = ps[0].dataIndex; return labs[i] + '<br/>' + (cfg.name || '') + '：' + cfg.tipFmt(vals[i]); }
      }),
      grid: baseGrid({ top: 40 }),
      xAxis: catAxis(labs, cfg.rotate == null ? 32 : cfg.rotate),
      yAxis: valAxis(cfg.axisFmt),
      series: [{
        type: 'bar', barMaxWidth: cfg.barWidth || 34,
        label: { show: true, position: 'top', fontSize: 10.5, fontWeight: 700, color: ink, formatter: function (p) { return cfg.tipFmt(p.value); } },
        data: vals.map(function (v, i) {
          return { value: v, itemStyle: { color: cfg.colorFn ? cfg.colorFn(v, ts[i].key) : groupColor(ts[i].key), borderRadius: [4, 4, 0, 0] } };
        })
      }]
    };
    if (cfg.yMax) opt.yAxis.max = cfg.yMax;
    if (isNum(cfg.markVal)) {
      opt.series[0].markLine = {
        symbol: 'none', silent: true,
        lineStyle: { color: deep, type: 'dashed', width: 1.5 },
        label: { color: deep, fontSize: 10, formatter: (cfg.markName || '中心') + ' ' + cfg.tipFmt(cfg.markVal) },
        data: [{ yAxis: cfg.markVal }]
      };
    }
    makeChart(id, opt);
  }

  function metricTable(elId, sec, rows, cols) {
    var html = '<thead><tr><th>二级/监控指标</th>' + cols.map(function (c) { return '<th>' + c.n + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r.label + '</td>' + cols.map(function (c) {
        var v = r.row ? r.row[c.k] : null;
        return editTd(sec, r.metric || r.label, c.k, v, r.fmt);
      }).join('') + '</tr>';
    });
    document.getElementById(elId).innerHTML = html + '</tbody>';
  }
  function allCols(data) {
    return data.teams.map(function (t) { return { k: t.key, n: teamLabel(t) }; })
      .concat(data.groups.map(function (g) { return { k: g, n: g }; }));
  }

  /* ================= 03 服务质量类 ================= */
  function renderSection3(data) {
    var s3 = data.section3 || {};
    var total = function (m) { return s3[m] ? s3[m]['中心合计'] : null; };
    kpiCards('kpiGrid3', [
      { label: '平台会话得分 · 中心', value: fmtDec(total('平台会话得分'), 2), unit: '分', foot: '总样本 ' + fmtInt(total('平台总样本')) + ' 条' },
      { label: '企微会话得分 · 中心', value: fmtDec(total('企微会话得分'), 2), unit: '分', foot: '总样本 ' + fmtInt(total('企微总样本')) + ' 条' },
      { label: '平台低分占比 · 中心', value: pct2(total('平台低分占比')), foot: '低分样本 ' + fmtInt(total('平台样本低分量')) + ' 条' },
      { label: '企微低分占比 · 中心', value: pct2(total('企微低分占比')), foot: '低分样本 ' + fmtInt(total('企微样本低分量')) + ' 条' }
    ]);
    var ex = ['追单'];
    teamBarEx('chart-plat-score', s3['平台会话得分'], { name: '平台会话得分', exclude: ex, tipFmt: function (v) { return fmtDec(v, 2) + ' 分'; }, axisFmt: function (v) { return v.toFixed(1); }, markVal: total('平台会话得分') });
    teamBarEx('chart-plat-low', s3['平台低分占比'], { name: '低分占比', exclude: ex, tipFmt: pct2, axisFmt: function (v) { return (v * 100).toFixed(0) + '%'; }, markVal: total('平台低分占比'), colorFn: function (v, k) { return v > total('平台低分占比') ? deep : groupColor(k); } });
    teamBarEx('chart-wecom-score', s3['企微会话得分'], { name: '企微会话得分', exclude: ex, tipFmt: function (v) { return fmtDec(v, 2) + ' 分'; }, axisFmt: function (v) { return v.toFixed(1); }, markVal: total('企微会话得分') });
    teamBarEx('chart-wecom-low', s3['企微低分占比'], { name: '低分占比', exclude: ex, tipFmt: pct2, axisFmt: function (v) { return (v * 100).toFixed(0) + '%'; }, markVal: total('企微低分占比'), colorFn: function (v, k) { return v > total('企微低分占比') ? deep : groupColor(k); } });

    metricTable('table-sec3', 'section3', [
      { label: '平台会话得分', metric: '平台会话得分', row: s3['平台会话得分'], fmt: function (v) { return fmtDec(v, 2); } },
      { label: '平台·总样本', metric: '平台总样本', row: s3['平台总样本'], fmt: fmtInt },
      { label: '平台·样本低分量', metric: '平台样本低分量', row: s3['平台样本低分量'], fmt: fmtInt },
      { label: '平台·低分占比', metric: '平台低分占比', row: s3['平台低分占比'], fmt: pct2 },
      { label: '企微会话得分', metric: '企微会话得分', row: s3['企微会话得分'], fmt: function (v) { return fmtDec(v, 2); } },
      { label: '企微·总样本', metric: '企微总样本', row: s3['企微总样本'], fmt: fmtInt },
      { label: '企微·样本低分量', metric: '企微样本低分量', row: s3['企微样本低分量'], fmt: fmtInt },
      { label: '企微·低分占比', metric: '企微低分占比', row: s3['企微低分占比'], fmt: pct2 }
    ], allCols(data));
  }

  /* ================= 04 客户资产类 ================= */
  function renderSection4(data) {
    var s4 = data.section4 || {};
    var total = function (m) { return s4[m] ? s4[m]['中心合计'] : null; };
    kpiCards('kpiGrid4', [
      { label: '企微添加率 · 中心', value: pct2(total('企微添加率')), foot: '综合组 ' + pct2((s4['企微添加率'] || {})['综合组']) + ' · 分品组 ' + pct2((s4['企微添加率'] || {})['分品组']) },
      { label: '企微转化率 · 中心', value: pct2(total('企微转化率')), foot: '综合组 ' + pct2((s4['企微转化率'] || {})['综合组']) + ' · 分品组 ' + pct2((s4['企微转化率'] || {})['分品组']) },
      { label: '当月蓄客金额 · 中心', value: fmtWan(total('当月蓄客金额')), foot: '未购预估 ' + fmtWan(total('未购顾客金额预估')) },
      { label: '客服消息数 · 中心', value: fmtWan(total('监控·客服消息数')), unit: '条', foot: '企微回复率 ' + pct2(total('监控·企微回复率')) }
    ]);
    var ex = ['追单'];
    var pctAxis = function (v) { return (v * 100).toFixed(0) + '%'; };
    teamBarEx('chart-wadd', s4['企微添加率'], { name: '企微添加率', exclude: ex, tipFmt: pct2, axisFmt: pctAxis, markVal: total('企微添加率') });
    teamBarEx('chart-wtag', s4['打标完整率'], { name: '打标完整率', exclude: ex, tipFmt: pct2, axisFmt: pctAxis, markVal: total('打标完整率') });
    teamBarEx('chart-wconv', s4['企微转化率'], { name: '企微转化率', exclude: ex, tipFmt: pct2, axisFmt: pctAxis, markVal: total('企微转化率') });
    teamBarEx('chart-wchurn', s4['监控·企微流失率'], { name: '企微流失率', exclude: ex, tipFmt: pct2, axisFmt: pctAxis, markVal: total('监控·企微流失率'), colorFn: function (v, k) { return v > total('监控·企微流失率') ? deep : groupColor(k); } });
    teamBarEx('chart-wreply', s4['监控·企微回复率'], { name: '企微回复率', exclude: ex, tipFmt: pct2, axisFmt: pctAxis, markVal: total('监控·企微回复率'), yMax: 1.05 });
    teamBarEx('chart-wfollow', s4['监控·顾客跟进情况记录'], { name: '跟进记录', exclude: ex, tipFmt: function (v) { return fmtInt(v) + ' 条'; }, axisFmt: function (v) { return v; } });
    teamBarEx('chart-wmsg', s4['监控·客服消息数'], { name: '客服消息数', exclude: ex, tipFmt: function (v) { return fmtInt(v) + ' 条'; }, axisFmt: function (v) { return (v / 10000).toFixed(0) + '万'; } });
    teamBarEx('chart-wbought', s4['监控·已购销售顾客占比'], { name: '已购销售顾客占比', exclude: ex, tipFmt: pct2, axisFmt: pctAxis, markVal: total('监控·已购销售顾客占比'), barWidth: 46, rotate: 0 });

    /* 蓄客金额对比（双系列） */
    var ts = data.teams.filter(function (t) { return t.key !== '追单'; });
    var labs = ts.map(function (t) { return teamLabel(t); });
    var rev = s4['当月蓄客金额'] || {}, unb = s4['未购顾客金额预估'] || {};
    makeChart('chart-wmoney', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          return labs[i] + '<br/>当月蓄客金额：¥' + fmtWan(isNum(rev[ts[i].key]) ? rev[ts[i].key] : null) +
            '<br/>未购顾客金额预估：¥' + fmtWan(isNum(unb[ts[i].key]) ? unb[ts[i].key] : null);
        }
      }),
      legend: { top: 2, textStyle: { color: ink, fontSize: 12 } },
      grid: baseGrid({ top: 46 }),
      xAxis: catAxis(labs, 32),
      yAxis: valAxis(function (v) { return (v / 10000).toFixed(0) + '万'; }),
      series: [
        { name: '当月蓄客金额', type: 'bar', barMaxWidth: 22, itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: 'top', fontSize: 9, fontWeight: 700, color: accent, formatter: function (p) { return fmtWan(p.value); } },
          data: ts.map(function (t) { return isNum(rev[t.key]) ? rev[t.key] : null; }) },
        { name: '未购顾客金额预估', type: 'bar', barMaxWidth: 22, itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: 'top', fontSize: 9, fontWeight: 700, color: accent2, formatter: function (p) { return fmtWan(p.value); } },
          data: ts.map(function (t) { return isNum(unb[t.key]) ? unb[t.key] : null; }) }
      ]
    });

    metricTable('table-sec4', 'section4', [
      { label: '企微添加率', row: s4['企微添加率'], fmt: pct2 },
      { label: '打标完整率', row: s4['打标完整率'], fmt: pct2 },
      { label: '当月蓄客金额', row: s4['当月蓄客金额'], fmt: fmtWan },
      { label: '未购顾客金额预估', row: s4['未购顾客金额预估'], fmt: fmtWan },
      { label: '企微转化率', row: s4['企微转化率'], fmt: pct2 },
      { label: '监控·顾客跟进情况记录', row: s4['监控·顾客跟进情况记录'], fmt: fmtInt },
      { label: '监控·企微流失率', row: s4['监控·企微流失率'], fmt: pct2 },
      { label: '监控·已购销售顾客占比', row: s4['监控·已购销售顾客占比'], fmt: pct2 },
      { label: '监控·客服消息数', row: s4['监控·客服消息数'], fmt: fmtInt },
      { label: '监控·企微回复率', row: s4['监控·企微回复率'], fmt: pct2 }
    ], allCols(data));
  }

  /* ================= 05 质量执行类 ================= */
  function renderSection5(data) {
    var s5 = data.section5 || {};
    var total = function (m) { return s5[m] ? s5[m]['中心合计'] : null; };
    kpiCards('kpiGrid5', [
      { label: 'AI 预警闭环率 · 中心', value: pct2(total('AI 预警闭环率')), foot: '综合组 ' + pct2((s5['AI 预警闭环率'] || {})['综合组']) + ' · 分品组 ' + pct2((s5['AI 预警闭环率'] || {})['分品组']) },
      { label: '优秀案例提报量 · 中心', value: fmtInt(total('优秀案例提报量')), unit: '个', foot: '综合组 ' + fmtInt((s5['优秀案例提报量'] || {})['综合组']) + ' · 分品组 ' + fmtInt((s5['优秀案例提报量'] || {})['分品组']) },
      { label: '二级接待挽回率 · 中心', value: pct2(total('二级接待挽回率')), foot: '综合组 ' + pct2((s5['二级接待挽回率'] || {})['综合组']) + ' · 分品组 ' + pct2((s5['二级接待挽回率'] || {})['分品组']) },
      { label: '千牛未回复人数 · 中心', value: fmtInt(total('监控·千牛未回复人数')), unit: '人', foot: '千询单问题量 ' + fmtDec(total('监控·千询单问题量'), 2) }
    ]);
    var pctAxis = function (v) { return (v * 100).toFixed(0) + '%'; };
    teamBarEx('chart-ai-close', s5['AI 预警闭环率'], { name: 'AI 预警闭环率', tipFmt: pct2, axisFmt: pctAxis, markVal: total('AI 预警闭环率'), yMax: 1.06 });
    teamBarEx('chart-good-case', s5['优秀案例提报量'], { name: '优秀案例提报量', tipFmt: function (v) { return fmtInt(v) + ' 个'; }, axisFmt: function (v) { return v; } });
    teamBarEx('chart-unreply', s5['监控·千牛未回复人数'], { name: '千牛未回复人数', tipFmt: function (v) { return fmtInt(v) + ' 人'; }, axisFmt: function (v) { return v; }, colorFn: function (v) { return v >= 2 ? deep : accent; } });
    teamBarEx('chart-q-issue', s5['监控·千询单问题量'], { name: '千询单问题量', tipFmt: function (v) { return fmtDec(v, 2); }, axisFmt: function (v) { return v.toFixed(1); }, markVal: total('监控·千询单问题量'), colorFn: function (v, k) { return v > total('监控·千询单问题量') ? deep : groupColor(k); } });

    /* 二级接待挽回率（组级） */
    var sv = s5['二级接待挽回率'] || {};
    var saveCats = ['综合组', '分品组', '中心合计'];
    var saveColors = { '综合组': accent, '分品组': accent2, '中心合计': deep };
    makeChart('chart-save', {
      animation: false, textStyle: { fontFamily: FONT },
      tooltip: Object.assign({}, tooltipBase, {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) { return ps[0].name + '<br/>二级接待挽回率：' + pct2(ps[0].value); }
      }),
      grid: baseGrid({ top: 40 }),
      xAxis: catAxis(saveCats, 0),
      yAxis: valAxis(pctAxis),
      series: [{
        type: 'bar', barMaxWidth: 56,
        label: { show: true, position: 'top', fontSize: 11, fontWeight: 700, color: ink, formatter: function (p) { return pct2(p.value); } },
        data: saveCats.map(function (c) {
          return { value: isNum(sv[c]) ? sv[c] : null, itemStyle: { color: saveColors[c], borderRadius: [5, 5, 0, 0] } };
        })
      }]
    });

    metricTable('table-sec5', 'section5', [
      { label: 'AI 预警闭环率', row: s5['AI 预警闭环率'], fmt: pct2 },
      { label: '优秀案例提报量', row: s5['优秀案例提报量'], fmt: fmtInt },
      { label: '考试通过率（本期未填报）', row: s5['考试通过率'], fmt: pct2 },
      { label: '二级接待挽回率', row: s5['二级接待挽回率'], fmt: pct2 },
      { label: '监控·千牛未回复人数', row: s5['监控·千牛未回复人数'], fmt: fmtInt },
      { label: '监控·千询单问题量', row: s5['监控·千询单问题量'], fmt: function (v) { return fmtDec(v, 2); } }
    ], allCols(data));

    /* 待改进问题类别（文本表） */
    var iss = data.issues || {};
    var rows = data.teams.map(function (t) { return { k: t.key, n: teamLabel(t) }; })
      .concat(data.groups.map(function (g) { return { k: g, n: g }; }));
    var html = '<thead><tr><th>团队</th><th style="text-align:left">待改进三级问题类别</th></tr></thead><tbody>';
    rows.forEach(function (t) {
      var txt = iss[t.k];
      if (editMode) {
        html += '<tr><td>' + t.n + '</td><td class="txt" contenteditable="true" spellcheck="false" data-edit="issues\u0001\u0001' + t.k + '">' + (txt || '') + '</td></tr>';
      } else {
        html += '<tr><td>' + t.n + '</td><td class="txt">' + (txt ? txt : '—') + '</td></tr>';
      }
    });
    document.getElementById('table-issues').innerHTML = html + '</tbody>';
  }

  /* ================= 总渲染 ================= */
  function renderAll(data) {
    currentData = data;
    renderKPI(data);
    renderSection1(data);
    renderSection2(data);
    renderSection3(data);
    renderSection4(data);
    renderSection5(data);
  }

  /* 对比新旧数据：统计发生变化的数值单元格个数 */
  function countCellChanges(nd, od) {
    if (!od) return 0;
    var cnt = 0;
    function cmpRow(nr, orw) {
      Object.keys(nr || {}).forEach(function (k) {
        var a = nr[k], b = orw ? orw[k] : undefined;
        if (a !== b && !(a == null && b == null)) cnt++;
      });
    }
    ['section1', 'section3', 'section4', 'section5'].forEach(function (sec) {
      Object.keys(nd[sec] || {}).forEach(function (m) { cmpRow(nd[sec][m], (od[sec] || {})[m]); });
    });
    ['coreVolume', 'coreRate'].forEach(function (m) {
      cmpRow(nd.section2[m], (od.section2 || {})[m]);
    });
    Object.keys(nd.section2.modelConv || {}).forEach(function (k) {
      var a = nd.section2.modelConv[k], b = (od.section2.modelConv || {})[k];
      if (a !== b && !(a == null && b == null)) cnt++;
    });
    Object.keys(nd.section2.modelSales || {}).forEach(function (k) {
      var a = nd.section2.modelSales[k] || {}, b = (od.section2.modelSales || {})[k] || {};
      ['volume', 'target'].forEach(function (f) {
        if (a[f] !== b[f] && !(a[f] == null && b[f] == null)) cnt++;
      });
    });
    return cnt;
  }

  /* ================= Excel 导入 · 自动匹配 ================= */
  function normLabel(v) {
    return v == null ? '' : String(v).replace(/[\s　]+/g, '');
  }

  function parseWorkbook(wb) {
    var names = wb.SheetNames;
    function findSheet(kw) {
      for (var i = 0; i < names.length; i++) {
        if (names[i].indexOf(kw) >= 0 && names[i].indexOf('(') < 0) return names[i];
      }
      return null;
    }
    var s0name = findSheet('监控总看板');
    var s2name = findSheet('品线结构');
    if (!s0name) throw new Error('未找到「监控总看板」工作表，请确认导入的是淘系二级指标监控地图模板。');

    var s0 = XLSX.utils.sheet_to_json(wb.Sheets[s0name], { header: 1, raw: true, defval: null });
    var s2 = s2name ? XLSX.utils.sheet_to_json(wb.Sheets[s2name], { header: 1, raw: true, defval: null }) : [];

    /* 表头行：团队列定位 */
    var hRow = -1;
    for (var r = 0; r < s0.length; r++) {
      if (normLabel(s0[r][0]) === '二级/监控指标') { hRow = r; break; }
    }
    if (hRow < 0) throw new Error('在「监控总看板」中未找到表头行（二级/监控指标）。');

    var colmap = []; // {col, key, name}
    var groups = [];
    for (var c = 1; c < (s0[hRow] || []).length; c++) {
      var raw = s0[hRow][c];
      if (!raw) continue;
      var parts = String(raw).split('\n');
      var key = normLabel(parts[0]);
      if (key === '备注说明') break;
      var name = parts[1] ? normLabel(parts[1]) : '';
      colmap.push({ col: c, key: key, name: name });
      if (key === '综合组' || key === '分品组' || key === '中心合计') groups.push(key);
    }
    var teams = colmap.filter(function (x) { return groups.indexOf(x.key) < 0; })
      .map(function (x) { return { key: x.key, name: x.name }; });

    function findRow(sheet, label) {
      var target = normLabel(label);
      for (var r = 0; r < sheet.length; r++) {
        if (normLabel(sheet[r][0]) === target) return r;
      }
      return -1;
    }
    function readRow(sheet, label) {
      var r = findRow(sheet, label);
      if (r < 0) return null;
      var out = {};
      colmap.forEach(function (cm) {
        out[cm.key] = toNum(sheet[r][cm.col]);
      });
      return out;
    }

    var matched = 0, missed = [];
    var section1 = {};
    ['销售额', '销售额占比', '单流量', '转化率', '客单价', '监控·接待/询单率'].forEach(function (m) {
      var d = readRow(s0, m);
      if (d) { section1[m] = d; matched++; }
      else {
        missed.push(m);
        if (currentData && currentData.section1[m]) section1[m] = currentData.section1[m];
      }
    });

    /* 品线结构 */
    var coreVolume = readRow(s0, '核心品台量'); if (coreVolume) matched++; else missed.push('核心品台量');
    var coreRate = readRow(s0, '台量达成率'); if (coreRate) matched++; else missed.push('台量达成率');

    var rHdr = findRow(s0, '核心品');
    var rConv = findRow(s0, '核心品咨询转化率');
    var models = [], modelConv = {};
    if (rHdr >= 0) {
      for (var cc = 1; cc < (s0[rHdr] || []).length; cc++) {
        var mv = s0[rHdr][cc];
        if (!mv) continue;
        var mn = String(mv).trim();
        if (mn === '合计' || mn === '目标' || mn === '目标完成率') break;
        models.push(mn);
        if (rConv >= 0) {
          var cv = s0[rConv][cc];
          modelConv[mn] = (typeof cv === 'number' && isFinite(cv)) ? cv : null;
        }
      }
      matched++;
    } else missed.push('核心品型号行');

    /* 分型号台量/目标/进度（02 品线结构类） */
    var modelSales = {};
    if (s2.length && models.length) {
      var inModels = {};
      models.forEach(function (m) { inModels[m] = true; });
      for (var rr = 0; rr < s2.length; rr++) {
        var a = s2[rr] && s2[rr][0];
        if (a == null) continue;
        var an = String(a).trim();
        if (inModels[an]) {
          var t = s2[rr][2], v = s2[rr][3], p = s2[rr][4];
          modelSales[an] = {
            target: (typeof t === 'number' && isFinite(t)) ? t : null,
            volume: (typeof v === 'number' && isFinite(v)) ? v : null,
            progress: (typeof p === 'number' && isFinite(p)) ? p : null
          };
        }
      }
      if (Object.keys(modelSales).length) matched++; else missed.push('分型号台量');
    }

    /* 套系 */
    function readSuite(sheet, label) {
      var r0 = findRow(sheet, label);
      if (r0 < 0) return null;
      var cats = [], dat = { '中心': [], '综合组': [], '分品组': [] };
      for (var r = r0 + 1; r < sheet.length; r++) {
        var lab = normLabel(sheet[r][0]);
        if (!lab) break;
        if (lab === '多件套合计') break;
        cats.push(String(sheet[r][0]).trim());
        ['中心', '综合组', '分品组'].forEach(function (L, idx) {
          var v = sheet[r][idx + 1];
          dat[L].push((typeof v === 'number' && isFinite(v)) ? v : null);
        });
      }
      return { cats: cats, dat: dat };
    }
    var suiteVol = readSuite(s0, '分品线套系销售量');
    var suiteRate = readSuite(s0, '套系销售占比');
    if (suiteVol) matched++; else missed.push('分品线套系销售量');
    if (suiteRate) matched++; else missed.push('套系销售占比');

    /* 03 服务质量类：锚点行 + 行偏移（规避「总样本」等重复标签） */
    function readRowAt(r) {
      if (r < 0 || !s0[r]) return null;
      var out = {};
      colmap.forEach(function (cm) {
        var v = s0[r][cm.col];
        out[cm.key] = toNum(v);
      });
      return out;
    }
    var section3 = {};
    function fillS3(key, r) {
      var d = readRowAt(r);
      if (d) section3[key] = d;
      else if (currentData && currentData.section3 && currentData.section3[key]) section3[key] = currentData.section3[key];
    }
    var rPlat = findRow(s0, '平台会话得分');
    if (rPlat >= 0) {
      fillS3('平台会话得分', rPlat); fillS3('平台总样本', rPlat + 2);
      fillS3('平台样本低分量', rPlat + 5); fillS3('平台低分占比', rPlat + 6);
      matched++;
    } else missed.push('平台会话得分');
    var rWc = findRow(s0, '企微会话得分');
    if (rWc >= 0) {
      fillS3('企微会话得分', rWc); fillS3('企微总样本', rWc + 2);
      fillS3('企微样本低分量', rWc + 5); fillS3('企微低分占比', rWc + 6);
      matched++;
    } else missed.push('企微会话得分');

    /* 04 客户资产类 */
    var section4 = {};
    ['企微添加率', '打标完整率', '当月蓄客金额', '未购顾客金额预估', '企微转化率', '监控·顾客跟进情况记录', '监控·企微流失率', '监控·已购销售顾客占比', '监控·客服消息数', '监控·企微回复率'].forEach(function (m) {
      var d = readRow(s0, m);
      if (d) { section4[m] = d; matched++; }
      else {
        missed.push(m);
        if (currentData && currentData.section4 && currentData.section4[m]) section4[m] = currentData.section4[m];
      }
    });

    /* 05 质量执行类 */
    var section5 = {};
    ['AI 预警闭环率', '优秀案例提报量', '考试通过率', '二级接待挽回率', '监控·千牛未回复人数', '监控·千询单问题量'].forEach(function (m) {
      var d = readRow(s0, m);
      if (d) { section5[m] = d; matched++; }
      else {
        missed.push(m);
        if (currentData && currentData.section5 && currentData.section5[m]) section5[m] = currentData.section5[m];
      }
    });
    var issues = {};
    var rIss = findRow(s0, '待改进三级问题类别监控');
    if (rIss >= 0) {
      colmap.forEach(function (cm) {
        var v = s0[rIss][cm.col];
        issues[cm.key] = (v == null || v === '/') ? '' : String(v);
      });
      matched++;
    } else if (currentData && currentData.issues) issues = currentData.issues;

    /* 统计周期 */
    var period = null;
    for (var pr = 0; pr < Math.min(4, s0.length); pr++) {
      var cell = normLabel(s0[pr][0]);
      if (cell.indexOf('统计周期') >= 0 && /\d/.test(cell)) { period = String(s0[pr][0]).trim(); break; }
    }

    return {
      meta: { period: period || (currentData && currentData.meta.period) || '', source: s0name },
      teams: teams, groups: groups,
      section1: section1,
      section2: {
        coreVolume: coreVolume || (currentData || {}).section2 && currentData.section2.coreVolume,
        coreRate: coreRate || (currentData || {}).section2 && currentData.section2.coreRate,
        models: models.length ? models : (currentData ? currentData.section2.models : []),
        modelConv: Object.keys(modelConv).length ? modelConv : (currentData ? currentData.section2.modelConv : {}),
        modelSales: Object.keys(modelSales).length ? modelSales : (currentData ? currentData.section2.modelSales : {}),
        suiteCats: suiteVol ? suiteVol.cats : (currentData ? currentData.section2.suiteCats : []),
        suiteVolume: suiteVol ? suiteVol.dat : (currentData ? currentData.section2.suiteVolume : {}),
        suiteRate: suiteRate ? suiteRate.dat : (currentData ? currentData.section2.suiteRate : {})
      },
      section3: section3,
      section4: section4,
      section5: section5,
      issues: issues,
      _matched: matched, _missed: missed
    };
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, isErr) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ''; }, 4200);
  }

  function handleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var data = parseWorkbook(wb);
        var old = currentData;
        renderAll(data);
        if (data.meta.period) {
          document.getElementById('periodLabel').textContent = data.meta.period.indexOf('统计周期') >= 0 ? data.meta.period : '统计周期：' + data.meta.period;
        }
        document.getElementById('importStatus').textContent = '已导入：' + file.name + ' · 全部图表已按文件数据刷新';
        var changed = countCellChanges(data, old);
        var msg = '导入成功 · 匹配 ' + data._matched + ' 项指标 · 更新 ' + changed + ' 个数值';
        if (changed === 0) msg += '（文件数值与当前看板一致，若刚填写过请确认 Excel 已保存后再导入）';
        if (data._missed.length) msg += ' · 未匹配 ' + data._missed.length + ' 项（' + data._missed.join('、') + '）已保留原值';
        toast(msg, !!data._missed.length);
      } catch (err) {
        toast('导入失败：' + err.message, true);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- 编辑事件 ---------- */
  document.getElementById('btnEdit').addEventListener('click', function () {
    setEditMode(!editMode);
    toast(editMode ? '编辑模式已开启：点击各明细表中的数值单元格即可修改，回车或点空白处保存' : '编辑模式已关闭');
  });
  document.addEventListener('keydown', function (e) {
    if (!editMode) return;
    var t = e.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-edit')) return;
    if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
  });
  document.addEventListener('focusout', function (e) {
    if (!editMode) return;
    var t = e.target;
    var path = t && t.getAttribute && t.getAttribute('data-edit');
    if (!path) return;
    var orig = t.getAttribute('data-orig');
    var txt = t.textContent.trim();
    if (orig != null && orig === txt) return; /* 未改动 */
    commitEdit(path.split('\u0001'), txt);
  });
  document.addEventListener('focusin', function (e) {
    if (!editMode) return;
    var t = e.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-edit')) return;
    t.setAttribute('data-orig', t.textContent.trim());
    setTimeout(function () {
      var r = document.createRange(); r.selectNodeContents(t);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }, 0);
  });

  /* ---------- 事件绑定 ---------- */
  document.getElementById('btnImport').addEventListener('click', function () {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', function (e) {
    handleFile(e.target.files[0]);
    e.target.value = '';
  });
  var topbar = document.getElementById('topbar');
  ['dragenter', 'dragover'].forEach(function (ev) {
    window.addEventListener(ev, function (e) { e.preventDefault(); topbar.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    window.addEventListener(ev, function (e) { e.preventDefault(); topbar.classList.remove('dragover'); });
  });
  window.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });

  window.addEventListener('resize', function () {
    charts.forEach(function (c) { c.resize(); });
  });

  /* ---------- 首次渲染 ---------- */
  renderAll(window.DEFAULT_DATA);
})();