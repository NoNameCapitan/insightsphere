import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from platform_support import single_worker, lock_file
from providers import bounded_process, ProviderError, claude_info


class PlatformTests(unittest.TestCase):
    def run_worker(self, code, **options):
        args = dict(timeout=3, cancel=None, cwd=None, env=None, max_output=2_000_000)
        args.update(options)
        return single_worker([sys.executable, '-c', code], 'Привіт'*20000, **args)

    def test_unicode_input_and_parallel_output(self):
        code, out, err = self.run_worker("import sys; s=sys.stdin.buffer.read(); sys.stdout.buffer.write(s); sys.stderr.write('check')")
        self.assertEqual((code, out, err), (0, 'Привіт'*20000, 'check'))

    def test_timeout_and_output_limits(self):
        for code, options in [('import time; time.sleep(20)', {'timeout': .1}), ("print('x'*2100000)", {})]:
            with self.subTest(code=code), self.assertRaises(ValueError):
                self.run_worker(code, **options)

    def test_active_cancellation(self):
        event = threading.Event()
        timer = threading.Timer(.1, event.set)
        timer.start()
        try:
            with self.assertRaisesRegex(ValueError, 'остановлен'):
                self.run_worker('import time; time.sleep(20)', cancel=event)
        finally:
            timer.join()

    def test_windows_disallows_unverified_cli(self):
        with patch('providers.sys.platform', 'win32'):
            self.assertEqual(claude_info()['status'], 'incompatible')
            with self.assertRaises(ProviderError):
                bounded_process(['claude', '-p', 'hello'])

    def test_windows_lock_uses_first_byte_and_failure_closes_handle(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'state.lock'
            fake = Mock(LK_NBLCK=2)
            with patch.dict(sys.modules, msvcrt=fake), patch('platform_support.os.name', 'nt'):
                handle = lock_file(path)
                fake.locking.assert_called_once_with(handle.fileno(), 2, 1)
                self.assertEqual(handle.tell(), 0)
                handle.close()
                fake.locking.side_effect = OSError('locked')
                with self.assertRaises(OSError):
                    lock_file(path)
