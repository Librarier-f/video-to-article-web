"""Single-process admission and explicit recovery for small-server deployments."""
import json
import os
from contextlib import contextmanager
from threading import Lock

from fastapi import HTTPException
from models import Task


_creation_lock = Lock()
TERMINAL_STATES = ('completed', 'failed')


@contextmanager
def task_admission(db):
    # The lock covers both counting and the caller's database commit. Deploy
    # with one Uvicorn worker; separate processes cannot share this lock.
    limit = int(os.environ.get('MAX_ACTIVE_TASKS', '0'))
    if limit < 0:
        raise ValueError('MAX_ACTIVE_TASKS must be zero or a positive integer')
    with _creation_lock:
        if limit and db.query(Task).filter(Task.status.notin_(TERMINAL_STATES)).count() >= limit:
            raise HTTPException(429, '服务器正在处理其他转换任务，请等待完成后重试。',
                                headers={'Retry-After': '30'})
        yield


def recover_interrupted_tasks(db):
    rows = db.query(Task).filter(Task.status.notin_(TERMINAL_STATES)).all()
    for row in rows:
        try:
            logs = json.loads(row.logs or '[]')
        except (TypeError, ValueError):
            logs = []
        if not isinstance(logs, list):
            logs = []
        logs.append('[中断] 服务已重启，原后台任务无法恢复，请重新提交；已生成的文章仍然保留。')
        row.logs = json.dumps(logs, ensure_ascii=False)
        row.status = 'failed'
        row.current_step = '服务重启，任务已中断，请重新提交'
    db.commit()
    return len(rows)
