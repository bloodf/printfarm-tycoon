import { useGame } from '../../game/store'
import { clock, money } from '../../game/format'
import { Stars } from '../components/ui'
import { AppHeader } from './Laptop'

export function BankApp() {
  const sim = useGame((g) => g.sim)
  useGame((g) => g.rev)
  const today = sim.ledger.filter((l) => l.day === sim.day)
  const inc = today.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0)
  const out = today.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0)
  const days = Array.from({ length: 7 }, (_, i) => sim.day - 6 + i).filter((d) => d >= 1)
  const series = days.map((d) => {
    const ls = sim.ledger.filter((l) => l.day === d)
    return { d, inc: ls.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0), out: -ls.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0) }
  })
  const max = Math.max(10, ...series.map((s) => Math.max(s.inc, s.out)))
  return (
    <div className="app">
      <AppHeader title="Bank" />
      <div className="bank-top">
        <div className="card bank-balance">
          <div className="upper muted">Balance</div>
          <div className="display" style={{ fontSize: 44, fontWeight: 700 }}>{money(sim.money)}</div>
          <div className="row small"><span className="ok">+{money(inc)}</span><span className="danger">{money(out)}</span><span className="muted">today</span></div>
        </div>
        <div className="card bank-chart">
          <div className="row"><span className="upper muted grow">Last 7 days</span><span className="tiny ok">■ income</span><span className="tiny danger">■ costs</span></div>
          <svg viewBox="0 0 700 150" preserveAspectRatio="none" className="chart">
            {series.map((s, i) => {
              const x = 20 + i * 96
              const hi = (s.inc / max) * 120
              const ho = (s.out / max) * 120
              return (
                <g key={s.d}>
                  <rect x={x} y={130 - hi} width={30} height={hi} rx={4} fill="#3ddc84" opacity={0.85} />
                  <rect x={x + 34} y={130 - ho} width={30} height={ho} rx={4} fill="#ff4d4f" opacity={0.75} />
                  <text x={x + 32} y={146} fill="#8d98a6" fontSize="12" textAnchor="middle">D{s.d}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="card bank-rep">
          <div className="upper muted">Shop rating</div>
          <div className="row"><Stars value={sim.reputation} size={22} /><b className="display" style={{ fontSize: 22 }}>{sim.reputation.toFixed(2)}</b></div>
          <div className="small muted">{sim.reviews.length} reviews</div>
          {sim.reviews.slice(0, 2).map((r) => (
            <div key={r.orderId} className="tiny" style={{ marginTop: 4 }}><span className="stars" style={{ fontSize: 11 }}>{'★'.repeat(r.stars)}</span> “{r.text}” <span className="dim">– {r.customer}</span></div>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Day</th><th>Time</th><th>Category</th><th>Description</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {sim.ledger.length === 0 && <tr><td colSpan={5} className="empty muted">No transactions yet.</td></tr>}
            {sim.ledger.slice().reverse().slice(0, 60).map((l, i) => (
              <tr key={i}>
                <td className="mono dim">D{l.day}</td>
                <td className="mono dim">{clock(l.time)}</td>
                <td><span className="chip" style={{ textTransform: 'capitalize' }}>{l.category}</span></td>
                <td>{l.label}</td>
                <td className={`r mono ${l.amount >= 0 ? 'ok' : 'danger'}`}>{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
