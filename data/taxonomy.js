/* CarbonNet 知识脉络 —— 人工整理的领域本体树。
   结构：root > branch（碳材料体系/网络构建策略/器件与性能/应用场景）> leaf。
   leaf 字段：
     name/en  中英文名
     type     material | strategy | device | application
     tag      文献库 URL 参数 ?tag= 使用的规范英文标签
     match    用于与论文标题/关键词匹配的英文词条（小写）
     desc     中文解读（编辑整理）
   请勿手改匹配词条时破坏 tag 与 match 的对应关系。 */
window.CARBONNET_TAXONOMY = {
  name: '三维导电网络',
  en: '3D Conductive Network',
  type: 'root',
  desc: '以碳材料为骨架、在三维空间内形成连续电子/离子传输通道的电极体系，是超级电容器兼顾高功率与高能量的核心结构范式。',
  children: [
    {
      name: '碳材料体系', en: 'Carbon Material Systems', type: 'branch',
      desc: '构成三维网络的碳基“建材”：不同碳的同素异形体与衍生形态决定了网络的比表面积、孔结构与导电性。',
      children: [
        {
          name: '活性炭 / 多孔碳', en: 'Activated & Porous Carbon', type: 'material', tag: 'activated carbon',
          match: ['activated carbon', 'porous carbon', 'hierarchical porous', 'micropore', 'mesopore'],
          desc: '最成熟的工业化电极材料：以活化造孔获得高比表面，成本低、稳定性好。短板在于导电性依赖颗粒间接触，三维连续网络正是针对这一痛点的升级路径——把颗粒接触升级为连续碳骨架。',
        },
        {
          name: '碳纳米管', en: 'Carbon Nanotubes', type: 'material', tag: 'carbon nanotube',
          match: ['carbon nanotube', 'cnt ', 'cnts', 'swcnt', 'mwcnt'],
          desc: '一维 sp² 碳管兼具超高本征电导与力学柔性，是网络中的“导线”。垂直阵列、海绵与气凝胶形态可实现无粘结剂的自支撑电极，让每一根管都接入导电通路。',
        },
        {
          name: '石墨烯', en: 'Graphene', type: 'material', tag: 'graphene',
          match: ['graphene', 'reduced graphene', ' rgo', 'graphene oxide'],
          desc: '二维碳片层理论比表面极大、面内导电极佳。三维化的关键是把片层组装为互通网络——水凝胶、泡沫、皱褶球等形态在抑制堆叠的同时保留可及表面。',
        },
        {
          name: '碳纤维', en: 'Carbon Fiber', type: 'material', tag: 'carbon fiber',
          match: ['carbon fiber', 'carbon fibre', 'nanofiber', 'carbon nanofibre', 'electrospun carbon'],
          desc: '微米级连续纤维提供宏观尺度的结构强度与柔性，可直接织成布或毡作为自支撑集流体，再与活性材料复合形成“纤维级”导电网络。',
        },
        {
          name: '碳气凝胶 / 水凝胶', en: 'Carbon Aerogel & Hydrogel', type: 'material', tag: 'carbon aerogel',
          match: ['aerogel', 'hydrogel', 'cryogel', 'xerogel'],
          desc: '凝胶网络在干燥后保留三维孔道骨架：低密度、高孔隙率、可压缩。冻干或超临界干燥路径可把纳米片/纳米管“锁”在连通的网络里。',
        },
        {
          name: '生物质衍生碳', en: 'Biomass-derived Carbon', type: 'material', tag: 'biomass',
          match: ['biomass', 'cellulose', 'lignin', 'chitosan', 'wood-derived'],
          desc: '以天然组织的分级孔结构为模板（木材导管、稻壳、细菌纤维素等），碳化后继承其“血管式”通道网络，兼具低成本与绿色合成的双重优势。',
        },
        {
          name: '碳化物衍生碳 / 洋葱碳', en: 'Carbide-derived & Onion-like Carbon', type: 'material', tag: 'carbide-derived carbon',
          match: ['carbide-derived', 'onion-like carbon', 'carbon onion', 'carbon black'],
          desc: '零维纳米碳球密堆积形成完全外表面可及的导电网络：无孔内扩散限制，可实现毫秒级充放电，是“功率优先”设计的经典选择。',
        },
        {
          name: '碳布 / 碳泡沫', en: 'Carbon Cloth & Foam', type: 'material', tag: 'carbon foam',
          match: ['carbon cloth', 'carbon foam', 'carbon felt', 'carbon textile', 'carbon fabric'],
          desc: '商用化的自支撑碳织物与泡沫是柔性器件最便捷的骨架：既可作集流体，也可在其上原位生长活性层，直接进入器件组装。',
        },
      ],
    },
    {
      name: '网络构建策略', en: 'Network Construction Strategies', type: 'branch',
      desc: '把低维碳单元“织”成三维连续网络的工艺路线，决定网络的拓扑、缺陷与规模化可能。',
      children: [
        {
          name: '模板法', en: 'Template Method', type: 'strategy', tag: 'template',
          match: ['template', 'sacrificial', 'hard template', 'soft template', 'sio2 template'],
          desc: '以可去除的模板（SiO₂、PS 球、金属泡沫、冰晶等）反向塑造孔道与网络，孔结构可控性最强，代价是流程较长、去除模板常需刻蚀。',
        },
        {
          name: '水热 / 自组装', en: 'Hydrothermal Self-assembly', type: 'strategy', tag: 'hydrothermal',
          match: ['hydrothermal', 'self-assembl', 'solvothermal', 'gelation'],
          desc: '利用片层/管束间的 π-π 与氢键相互作用在水相中自发凝胶化，一步形成三维网络，温和、易放大，是石墨烯水凝胶路线的主流工艺。',
        },
        {
          name: 'CVD 生长', en: 'CVD Growth', type: 'strategy', tag: 'cvd',
          match: ['chemical vapor deposition', ' cvd', 'vapor deposition'],
          desc: '在三维骨架（镍泡沫、石英纤维等）上直接气相生长石墨烯/碳管网络：结晶质量高、接触电阻小，适合对导电性要求苛刻的骨架。',
        },
        {
          name: '冻干成型', en: 'Freeze-drying', type: 'strategy', tag: 'freeze-drying',
          match: ['freeze-dry', 'freeze drying', 'lyophil', 'ice templat'],
          desc: '冰晶作为绿色模板定向排布，升华后留下取向孔道，兼具模板法与自组装的优点，且全程无溶剂污染。',
        },
        {
          name: '静电纺丝', en: 'Electrospinning', type: 'strategy', tag: 'electrospinning',
          match: ['electrospinning', 'electrospun', 'nanofibrous'],
          desc: '高压电场下连续纺出纳米纤维毡，纤维交错构成天然三维网络，碳化后即为自支撑电极，适合柔性器件与规模化卷对卷生产。',
        },
        {
          name: '3D 打印', en: '3D Printing', type: 'strategy', tag: '3d printing',
          match: ['3d print', 'direct ink writing', 'additive manufacturing', '3d-printed'],
          desc: '直写墨水技术把网络拓扑变成可设计的“图纸”：周期孔道保证电解液贯通，厚电极（毫米级）下仍维持高倍率，是结构储能的前沿方向。',
        },
        {
          name: '化学活化造孔', en: 'Chemical Activation', type: 'strategy', tag: 'activation',
          match: ['koh', 'activation', 'activated', 'microwave exfoliat', 'chemical exfoliat'],
          desc: 'KOH 等活化剂在碳骨架上原位刻蚀出微介孔，同时伴随网络重建；比表面积可突破 3000 m²/g，是提升能量密度的最强杠杆之一。',
        },
        {
          name: '杂原子掺杂', en: 'Heteroatom Doping', type: 'strategy', tag: 'doping',
          match: ['nitrogen-doped', 'n-doped', 'heteroatom', 'doped carbon', 'n doping'],
          desc: 'N/B/P/S 等杂原子引入碳晶格：既贡献赝电容、改善润湿性，又调节电子结构提升导电性——常与网络构建策略叠加使用。',
        },
      ],
    },
    {
      name: '器件与性能', en: 'Devices & Performance', type: 'branch',
      desc: '三维导电网络在器件层面的落地形态与关键性能指标。',
      children: [
        {
          name: '双电层与赝电容', en: 'EDLC & Pseudocapacitance', type: 'device', tag: 'edlc',
          match: ['double-layer', 'edlc', 'pseudocapacit', 'faradaic', 'redox'],
          desc: '碳网络主体贡献双电层电容（离子吸附），掺杂与复合相贡献赝电容（快速氧化还原）。三维网络的价值在于同时缩短电子与离子传输路径，让两类机制都在高倍率下充分表达。',
        },
        {
          name: '对称 / 非对称器件', en: 'Symmetric & Asymmetric Devices', type: 'device', tag: 'asymmetric',
          match: ['asymmetric', 'symmetric device', 'hybrid supercapacitor', 'voltage window'],
          desc: '碳//碳对称器件循环最稳；碳网络负极搭配赝电容正极的非对称/混合器件则把电压窗口与能量密度推高，电荷平衡设计成为器件级难点。',
        },
        {
          name: '柔性 / 可穿戴', en: 'Flexible & Wearable', type: 'device', tag: 'flexible',
          match: ['flexible', 'wearable', 'stretchable', 'solid-state', 'gel electrolyte'],
          desc: '自支撑三维网络天然抗弯折，与凝胶电解质结合可制成全固态柔性器件，在弯折、扭转、拉伸循环下保持容量，是可穿戴电子的储能底座。',
        },
        {
          name: '微型器件', en: 'Micro-supercapacitors', type: 'device', tag: 'micro-supercapacitor',
          match: ['micro-supercapacitor', 'microsupercapacitor', 'on-chip', 'interdigital', 'miniaturized'],
          desc: '叉指结构 + 三维网络电极把离子扩散距离压到微米尺度，功率密度直追电解电容，面向片上储能与柔性电子皮肤。',
        },
        {
          name: '高倍率与循环', en: 'High Rate & Cycling', type: 'device', tag: 'rate capability',
          match: ['rate capability', 'cycling stability', 'high-power', 'power density', 'fast charging'],
          desc: '网络连续性是倍率性能的第一性保证：电子不绕路、离子不堵孔，方能同时获得高功率与万次级循环寿命。',
        },
      ],
    },
    {
      name: '应用场景', en: 'Application Scenarios', type: 'branch',
      desc: '三维导电网络超级电容器面向的典型应用出口。',
      children: [
        {
          name: '电网与静态储能', en: 'Grid & Stationary Storage', type: 'application', tag: 'grid',
          match: ['grid', 'stationary', 'energy storage system', 'load leveling', 'frequency regulation'],
          desc: '秒级响应的功率型储能参与调频与平抑波动，长循环寿命使其在电网侧的度电成本具备竞争力。',
        },
        {
          name: '电动交通', en: 'Electromobility', type: 'application', tag: 'electric vehicle',
          match: ['electric vehicle', 'automotive', 'transportation', 'regenerative braking'],
          desc: '与电池组网互补：回收制动能量、提供加速脉冲，三维网络的高功率特性直接转化为续航与动力体验。',
        },
        {
          name: '可穿戴电子', en: 'Wearable Electronics', type: 'application', tag: 'wearable electronics',
          match: ['electronic skin', 'smart textile', 'self-powered', 'health monitoring', 'implantable'],
          desc: '柔性储能单元与传感、无线模块一体化集成，为健康监测、电子织物提供体表级供能。',
        },
      ],
    },
  ],
};
