import { useEffect, useState } from 'react'
import { Reply } from 'lucide-react'
import { useGame } from '../../game/store'
import { readMail, replyMail } from '../../sim/sim'
import { clock } from '../../game/format'
import { dayOf } from '../../sim/sim'
import { Button } from '../components/ui'
import { AppHeader } from './Laptop'

const KIND_CHIP: Record<string, [string, string]> = {
  request: ['Request', 'accent'], complaint: ['Complaint', 'danger'], review: ['Review', 'warn'], supplier: ['Supplier', 'info'],
  system: ['LayerGoods', 'info'], info: ['Personal', ''],
}

export function MailApp() {
  const mail = useGame((g) => g.sim.mail)
  useGame((g) => g.rev)
  const act = useGame((g) => g.act)
  const [sel, setSel] = useState<string | null>(mail[0]?.id ?? null)
  const m = mail.find((x) => x.id === sel)
  useEffect(() => {
    if (m && !m.read) act((s) => { readMail(s, m.id); return { ok: true } })
  }, [m, act])
  const unread = mail.filter((x) => !x.read).length
  return (
    <div className="app mail">
      <AppHeader title="Mail"><span className="chip info">{unread} unread</span></AppHeader>
      <div className="mail-split">
        <div className="mail-list">
          {mail.map((x) => (
            <button key={x.id} className={`mail-item ${x.id === sel ? 'on' : ''} ${x.read ? '' : 'unread'}`} onClick={() => setSel(x.id)}>
              <div className="row" style={{ gap: 6 }}>
                {!x.read && <span className="dot" />}
                <b className="grow ellipsis">{x.fromName}</b>
                <span className="tiny dim mono">D{dayOf(x.time)} {clock(x.time)}</span>
              </div>
              <div className="ellipsis small">{x.subject}</div>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                {KIND_CHIP[x.kind] && <span className={`chip ${KIND_CHIP[x.kind][1]}`}>{KIND_CHIP[x.kind][0]}</span>}
                {x.choices && !x.chosen && <span className="chip warn">Needs reply</span>}
              </div>
            </button>
          ))}
        </div>
        <div className="mail-read">
          {!m && <div className="empty muted">Select an email</div>}
          {m && (
            <div className="anim-fade" key={m.id}>
              <div className="mail-subject display">{m.subject}</div>
              <div className="row small muted" style={{ margin: '4px 0 16px' }}>
                <span>From <b className="accent">{m.fromName}</b> &lt;{m.from}&gt;</span>
                <span className="spacer" />
                <span>Day {dayOf(m.time)}, {clock(m.time)}</span>
              </div>
              <div className="mail-body">{m.body}</div>
              {m.choices && !m.chosen && (
                <div className="mail-reply card">
                  <div className="upper muted row" style={{ gap: 6 }}><Reply size={14} /> Reply</div>
                  <div className="col" style={{ marginTop: 10, gap: 8 }}>
                    {m.choices.map((c) => (
                      <Button key={c.id} variant={c.id === 'accept' ? 'primary' : c.id === 'decline' ? 'ghost' : undefined} onClick={() => act((s) => replyMail(s, m.id, c.id), { ok: c.id === 'accept' ? 'Order created. Find it in Orders' : c.id === 'counter' ? 'Counter-offer sent. Expect a reply tomorrow' : undefined })} style={{ justifyContent: 'flex-start' }}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {m.replyText && (
                <div className="mail-sent card">
                  <div className="upper muted">Your reply</div>
                  <div style={{ marginTop: 6 }}>{m.replyText}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
