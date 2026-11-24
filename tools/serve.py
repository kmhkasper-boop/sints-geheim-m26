#!/usr/bin/env python3
"""Static file server with HTTP/1.1 Range/206 (needed for iOS Safari <video>)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import sys


class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    close_connection = False

    def end_headers(self):
        self.send_header("Connection", "close")
        super().end_headers()
        self.close_connection = True

    def send_head(self):
        path = self.translate_path(self.path.split("?", 1)[0])
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.isfile(path):
            self.send_error(404)
            return None
        ctype = self.guess_type(path)
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404)
            return None
        fs = os.fstat(f.fileno())
        size = fs.st_size
        rng = self.headers.get("Range")
        self._range = None
        if rng:
            m = re.match(r"bytes=(\d+)-(\d*)", rng.strip())
            if m:
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    f.close()
                    self.send_error(416, "Range Not Satisfiable")
                    return None
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
                self.send_header("Content-Length", str(end - start + 1))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                self._range = (start, end + 1)
                return f
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        rng = getattr(self, "_range", None)
        if rng:
            source.seek(rng[0])
            remaining = rng[1] - rng[0]
            while remaining > 0:
                chunk = source.read(min(65536, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        else:
            super().copyfile(source, outputfile)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    os.chdir(root)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), RangeHandler)
    print("serving %s on 127.0.0.1:%s (Range enabled)" % (os.getcwd(), port), flush=True)
    httpd.serve_forever()
