"""Platform-specific file locking and a bounded single-worker pipe supervisor."""
import os
import queue
import subprocess
import threading
import time


def lock_file(path):
    handle = path.open('a+b')
    try:
        if os.name == 'nt':
            import msvcrt
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return handle
    except BaseException:
        handle.close()
        raise


def single_worker(argv, input_text, *, timeout, cancel, cwd, env, max_output):
    """Used on Windows only for our Ollama HTTP worker, which has no children."""
    if cancel and cancel.is_set():
        raise ValueError('Вызов остановлен')
    proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, cwd=cwd, env=env)
    chunks = queue.Queue(maxsize=8)
    stop = threading.Event()
    output = {'out': bytearray(), 'err': bytearray()}
    def send(item):
        while not stop.is_set():
            try:
                chunks.put(item, timeout=.05)
                return
            except queue.Full:
                pass
    def read(pipe, name):
        try:
            while not stop.is_set():
                data = pipe.read(4096)
                if not data:
                    break
                send((name, data))
        finally:
            send((name, None))
    def write():
        try:
            proc.stdin.write(input_text.encode('utf-8'))
            proc.stdin.flush()
        except (OSError, ValueError):
            pass
        finally:
            proc.stdin.close()
    threads = [threading.Thread(target=read, args=(proc.stdout, 'out'), daemon=True),
               threading.Thread(target=read, args=(proc.stderr, 'err'), daemon=True),
               threading.Thread(target=write, daemon=True)]
    deadline = time.monotonic()+timeout
    for t in threads:
        t.start()
    finished = set()
    try:
        while len(finished) < 2 or proc.poll() is None:
            if cancel and cancel.is_set():
                raise ValueError('Вызов остановлен')
            if time.monotonic() >= deadline:
                raise ValueError('Истёк лимит времени исполнителя')
            try:
                name, data = chunks.get(timeout=.05)
            except queue.Empty:
                continue
            if data is None:
                finished.add(name)
            else:
                output[name].extend(data)
                if sum(map(len, output.values())) > max_output:
                    raise ValueError('Ответ превысил лимит 2 МБ')
        return proc.wait(), output['out'].decode('utf-8', 'replace'), output['err'].decode('utf-8', 'replace')
    finally:
        stop.set()
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        for t in threads:
            t.join(timeout=1)
        for pipe in (proc.stdin, proc.stdout, proc.stderr):
            if not pipe.closed:
                pipe.close()
