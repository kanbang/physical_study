// 扩展内容 02 · 2 道分级训练题（27→35 个数值结果，全部经独立脚本核验）
// 与内置题库同形状：id / level / dom / model / title / text / hints / answers / solution / trap
export const ADDON_PROBLEMS = [
 {id:'p15',level:'高中',dom:'力学',model:'',title:'弹性碰撞能传走多少动能',
  text:'光滑水平面上，质量 $m_1=2\\ \\mathrm{kg}$ 的小球 A 以 $v_0=6\\ \\mathrm{m/s}$ 向右运动，与静止的 $m_2=1\\ \\mathrm{kg}$ 小球 B 发生一维完全弹性正碰。求碰后两球的速度（向右为正），以及 B 获得的动能占 A 初动能的百分比。',
  hints:['两个方程：动量守恒 $m_1v_0=m_1v_1+m_2v_2$，动能守恒 $\\tfrac12 m_1v_0^2=\\tfrac12 m_1v_1^2+\\tfrac12 m_2v_2^2$。','完全弹性正碰可用「接近速度 = 分离速度」：$v_2-v_1=v_0$，比解二次方程快得多。','通解 $v_1=\\frac{m_1-m_2}{m_1+m_2}v_0$，$v_2=\\frac{2m_1}{m_1+m_2}v_0$；能量传递比 $\\eta=\\frac{4m_1m_2}{(m_1+m_2)^2}$。'],
  answers:[{label:'碰后 A 的速度 v₁',value:2,unit:'m/s',tol:0.01},
           {label:'碰后 B 的速度 v₂',value:8,unit:'m/s',tol:0.01},
           {label:'B 获动能占比',value:88.89,unit:'%',tol:0.01}],
  solution:['动量守恒：$2\\times6=2v_1+v_2$，即 $12=2v_1+v_2$。','弹性条件：$v_2-v_1=v_0=6$。联立解得 $v_1=2\\ \\mathrm{m/s}$，$v_2=8\\ \\mathrm{m/s}$。','动能校核：初动能 $\\tfrac12\\times2\\times6^2=36\\ \\mathrm{J}$；末动能 $\\tfrac12\\times2\\times2^2+\\tfrac12\\times1\\times8^2=4+32=36\\ \\mathrm{J}$，守恒。','$\\eta=32/36=8/9\\approx88.9\\%$，与通式 $\\eta=\\frac{4\\times2\\times1}{3^2}=8/9$ 一致。','当 $m_1=m_2$ 时 $\\eta=1$，即速度交换、A 恰好停下；本题 $m_1>m_2$，A 不会停。'],
  trap:'把「完全弹性」直接当成 A 停下（只有等质量才停）；或把动能按速度线性分配。另注意 $v_1$ 带符号，本题仍向右。'},

 {id:'p16',level:'高中',dom:'电磁',model:'',title:'RC 充电：另一半能量去哪了',
  text:'电动势 $E=12\\ \\mathrm{V}$ 的理想电源（内阻忽略）经 $R=10\\ \\mathrm{k\\Omega}$ 给 $C=100\\ \\mu\\mathrm{F}$ 的电容器充电，电容初始不带电。求时间常数 $\\tau$、电容电压升到 $6\\ \\mathrm{V}$ 所需时间，以及充电完成后电源做的功、电容储能与电阻发热（用 mJ）。',
  hints:['$\\tau=RC$；$u_C(t)=E(1-e^{-t/\\tau})$，令 $u_C=E/2$ 得 $t=\\tau\\ln 2$。','流过电源的总电荷 $Q=CE$，故电源做功 $W=EQ=CE^2$；电容储能 $U_C=\\tfrac12 CE^2$。','发热 $Q_R=W-U_C=\\tfrac12 CE^2$ —— 与 $R$ 无关，$R$ 只决定快慢。'],
  answers:[{label:'时间常数 τ',value:1.0,unit:'s',tol:0.01},
           {label:'升到 6 V 的时间',value:0.693,unit:'s',tol:0.01},
           {label:'电源做功 W',value:14.4,unit:'mJ',tol:0.01},
           {label:'电容储能 U_C',value:7.2,unit:'mJ',tol:0.01},
           {label:'电阻发热 Q_R',value:7.2,unit:'mJ',tol:0.01}],
  solution:['$\\tau=RC=1.0\\times10^4\\times1.0\\times10^{-4}=1.0\\ \\mathrm{s}$。','$6=12(1-e^{-t/\\tau})\\Rightarrow e^{-t/\\tau}=1/2\\Rightarrow t=\\tau\\ln 2\\approx0.693\\ \\mathrm{s}$。','$Q=CE=1.0\\times10^{-4}\\times12=1.2\\times10^{-3}\\ \\mathrm{C}$，$W=EQ=12\\times1.2\\times10^{-3}=1.44\\times10^{-2}\\ \\mathrm{J}=14.4\\ \\mathrm{mJ}$。','$U_C=\\tfrac12 CE^2=0.5\\times10^{-4}\\times144=7.2\\times10^{-3}\\ \\mathrm{J}=7.2\\ \\mathrm{mJ}$。','$Q_R=\\int i^2R\\,\\mathrm{d}t=W-U_C=7.2\\ \\mathrm{mJ}$，能量守恒；把 $R$ 加倍只让 $\\tau$ 加倍，三个能量值都不变。'],
  trap:'误以为「电源做的功全部存进电容」，或认为换更大的 $R$ 能减少发热。另注意单位：$\\mu\\mathrm{F}$ 要化成 $10^{-6}\\ \\mathrm{F}$，答案用 mJ。'}
];
