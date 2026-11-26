import json
import logging
import os
import signal
from threading import Event
from pathlib import Path

from psycopg import connect
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from extract import extract

DATABASE = os.environ.get("DATABASE_URL", "postgresql://127.0.0.1:55432/question_bank")
STORAGE = Path(os.environ.get("STORAGE_DIR", ".data"))
logging.basicConfig(level=logging.INFO, format="%(message)s")


def log(event, **details):
    logging.info(json.dumps({"event": event, **details}))


def claim(conn):
    with conn.transaction():
        conn.execute("""
            update paper_imports set status='failed', stage='Import failed',
                error='Worker lease expired after the final attempt.', lease_until=null, claim_token=null
            where status='processing' and lease_until < now() and attempts >= 3
        """)
        return conn.execute("""
            with queued as (
                select id from paper_imports where attempts < 3 and (
                    status='queued' or (status='processing' and lease_until < now())
                ) order by created_at for update skip locked limit 1
            )
            update paper_imports p set status='processing', stage='Opening source documents',
                attempts=p.attempts+1, lease_until=now()+interval '3 minutes', claim_token=gen_random_uuid()
            from queued where p.id=queued.id returning p.id, p.claim_token, p.attempts
        """).fetchone()


def process(conn, job):
    import_id, token = job["id"], job["claim_token"]
    folder = STORAGE / str(import_id)

    def stage(label):
        with conn.transaction():
            updated = conn.execute("""
                update paper_imports set stage=%s, lease_until=now()+interval '3 minutes'
                where id=%s and claim_token=%s
            """, (label, import_id, token))
            if not updated.rowcount:
                raise RuntimeError("Worker lease lost.")

    try:
        # Each claim writes images to a unique directory. A stale claim cannot overwrite the winning artifacts.
        artifacts = folder / str(token)
        artifacts.mkdir(mode=0o700, exist_ok=True)
        explanation = folder / "explanations.pdf"
        key = folder / "key.pdf"
        items = extract(folder / "paper.pdf", key if key.is_file() else None, artifacts, stage,
                        explanation=explanation if explanation.is_file() else None)
        with conn.transaction():
            confirmed = conn.execute("""
                update paper_imports set status='ready', stage='Drafts ready', error=null, lease_until=null
                where id=%s and claim_token=%s returning id
            """, (import_id, token)).fetchone()
            if not confirmed:
                return
            with conn.cursor() as cursor:
                cursor.executemany("""
                    insert into question_drafts (import_id, number, page, content, original, issues)
                    values (%s,%s,%s,%s,%s,%s)
                """, [(import_id, number, page, Jsonb(content), Jsonb(content), Jsonb(issues))
                      for number, page, content, issues in items])
        log("import.ready", import_id=str(import_id), count=len(items))
    except Exception as error:
        retry = not isinstance(error, ValueError) and job["attempts"] < 3
        reason = str(error) if isinstance(error, ValueError) else "Worker could not process this file."
        with conn.transaction():
            conn.execute("""
                update paper_imports set status=%s, stage=%s, error=%s, lease_until=null, claim_token=null
                where id=%s and claim_token=%s
            """, ("queued" if retry else "failed", "Retry queued" if retry else "Import failed",
                  reason, import_id, token))
        log("import.failed", import_id=str(import_id), retry=retry, reason=str(error))


def main():
    stop = Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    while not stop.is_set():
        try:
            with connect(DATABASE, autocommit=True, row_factory=dict_row) as conn:
                while not stop.is_set():
                    job = claim(conn)
                    if job:
                        process(conn, job)
                    else:
                        stop.wait(2)
        except Exception as error:
            log("worker.connection_error", reason=str(error))
            stop.wait(4)


if __name__ == "__main__":
    main()
