"""PTY relay for acceptance. Executes an argv array, never a shell command."""
import codecs
import fcntl
import json
import os
import pty
import select
import signal
import sys
import struct
import termios

pid, fd = pty.fork()
if pid == 0:
    # Interactive components wrap to the actual terminal width. A fresh PTY defaults to 0x0.
    fcntl.ioctl(sys.stdout.fileno(), termios.TIOCSWINSZ, struct.pack('HHHH', 32, 120, 0, 0))
    os.execv(sys.argv[1], sys.argv[1:])
decoder = codecs.getincrementaldecoder('utf-8')('replace')
buffer = b''
try:
    while True:
        ready, _, _ = select.select([fd, sys.stdin.buffer], [], [], 0.25)
        if fd in ready:
            try:
                output = os.read(fd, 65536)
            except OSError:
                break
            if not output:
                break
            print(json.dumps({'output': decoder.decode(output)}, ensure_ascii=False), flush=True)
        if sys.stdin.buffer in ready:
            chunk = os.read(sys.stdin.fileno(), 65536)
            if not chunk:
                os.kill(pid, signal.SIGHUP)
                break
            buffer += chunk
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                command = json.loads(line)
                if 'send' in command:
                    os.write(fd, command['send'].encode('utf-8'))
                if command.get('interrupt'):
                    os.kill(pid, signal.SIGINT)
finally:
    os.close(fd)
    _, status = os.waitpid(pid, 0)
    print(json.dumps({'exit': os.waitstatus_to_exitcode(status)}), flush=True)
