# Small local test server for Stack Tower – STACKR.
# It hands the game files to the browser and tells the browser
# "don't keep old copies" (Cache-Control: no-store), so you always see the latest files.
#
# Start it from this folder with:   python3 server.py
# Stop it with:                      Ctrl + C

import http.server
import os

PORT = 8000

# Always serve the folder this file is in, no matter where it was started from.
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler)
print("Stack Tower test server is running.")
print("Open this address in your browser:  http://localhost:%d" % PORT)
print("To stop the server, press Ctrl + C")

try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
