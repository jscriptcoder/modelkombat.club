# Variety board — v19

_Frozen 6-bot gauntlet · 10 seeds · v19_

_§P7 soft targets: usage ≤ 35%, opener win ≤ 60%. Scan for ⚠ below._

```
ModelKombat variety telemetry v19
population: jabber, rekka, zoner, grappler, sweeper, vulture
6 bots · 10 seeds · round-robin = 300 fights · 7356 honoured commitments
note: small hand-authored reference population — shares reflect authored style, not discovered LLM behavior.

technique     count  share  adoption   mean
gyaku-zuki     2322  31.6%       4/6  24.8%
mawashi-geri   1437  19.5%       3/6  19.7%
kizami-zuki    1363  18.5%       2/6  18.5%
sweep           740  10.1%       1/6   8.3%
throw           357   4.9%       1/6   8.2%
uraken          269   3.7%       1/6   6.4%
tobi-geri       191   2.6%       1/6   1.3%
shuto           150   2.0%       1/6   3.3%
ushiro-geri     138   1.9%       1/6   1.9%
hiza-geri       132   1.8%       1/6   3.0%
empi            108   1.5%       1/6   2.5%
yoko-geri        84   1.1%       1/6   1.1%
mae-geri         65   0.9%       1/6   0.9%

effective moves 7.2 of 13   ·   live 13 / dead 0

opener        opens   W    L  D    win%
sweep            60  60    0  0  100.0%  ⚠
shuto            20  20    0  0  100.0%  ⚠
tobi-geri       100  59   41  0   59.0%
throw            76  44   32  0   57.9%
mawashi-geri    158  56  102  0   35.4%
kizami-zuki      80  17   63  0   21.3%
uraken           22   4   18  0   18.2%
gyaku-zuki        0   0    0  0       —
mae-geri          0   0    0  0       —
yoko-geri         0   0    0  0       —
ushiro-geri       0   0    0  0       —
empi              0   0    0  0       —
hiza-geri         0   0    0  0       —

null openers (turtled): 84

⚠ = opener win-rate over 60% (≥10 opens)

move             N  fail   rate  out-of-band  unaffordable  wrong-context  inert
tobi-geri      971   780  80.3%            0           650            130      0
hiza-geri      556   424  76.3%            0           424              0      0
sweep         3060  2320  75.8%            0          2320              0      0
empi           381   273  71.7%            0           273              0      0
mae-geri       187   122  65.2%            0           122              0      0
yoko-geri      204   120  58.8%            0           120              0      0
shuto          305   155  50.8%            0           155              0      0
mawashi-geri  2613  1176  45.0%            0          1176              0      0
throw          618   261  42.2%            0           261              0      0
ushiro-geri    234    96  41.0%            0            96              0      0
kizami-zuki   1934   571  29.5%            0           571              0      0
gyaku-zuki    3135   813  25.9%            0           813              0      0
uraken         312    43  13.8%            0            43              0      0

note: N = honoured + failed starts (locked excluded); a technique with 0 usage but failures here was chosen but never executed

zone          distance  frames  share
clinch          0-120k   12535   9.4%
hand range    120-240k   86279  64.4%
kick range    240-300k   22260  16.6%
poke range    300-330k   12572   9.4%
out of range     330k+     397   0.3%

note: one |a.x - b.x| sample per tick, bucketed by the reach ladder; poke = the >300k zoning pokes

move          starts  land   land%   pts  pts/start
gyaku-zuki      2322  1999   86.1%  3723        1.6
mawashi-geri    1437   643   44.7%  1929        1.3
kizami-zuki     1363   937   68.7%   937        0.7
throw            357   275   77.0%   825        2.3
tobi-geri        191   182   95.3%   546        2.9
shuto            150   144   96.0%   222        1.5
empi             108   108  100.0%   216        2.0
yoko-geri         84    26   31.0%    52        0.6
mae-geri          65     1    1.5%     2        0.0
sweep            740     —       —     0          —
uraken           269     0    0.0%     0        0.0
ushiro-geri      138     0    0.0%     0        0.0
hiza-geri        132     —       —     0          —

excluded penalty points: 282

note: pts joins each score to the move whose active window caught it; knockdown setups (sweep, hiza-geri) score via the okizeme finisher, shown —
```
