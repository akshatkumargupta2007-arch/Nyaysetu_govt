# Screen flow

```
/login ──Sign in──► /  Civic Pulse
                     ├─ Alerts ─► /alert ─► /complaints (filtered to the area) · back to /
                     ├─ nav: Complaints ► /complaints ─ row ─► side drawer ─ Proof tab ─► /court
                     │                                      └ Request closure (shows the latest proof verdict)
                     ├─ nav: Closure Court ► /queue ─ row ─► /court (Live / Replay, Submit proof, Open Challenge)
                     ├─ nav: Ask the City ► /ask
                     ├─ nav: Scorecard ► /scorecard
                     └─ national only: Benchmark /benchmark · System health /health · Audit log /audit
Header on every page: Generated data ► /legend · Legend ► /legend · View as · EN/हिं · Sign out ► /login
```

Opening a row or an alert stores the chosen item in `sessionStorage` (`gov.court`, `gov.alert`) and moves to the next screen.
