package io.github.bibbi88.flygineer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * A text line stream over TCP, for XC Guide's localhost server (FLARM sentences on port 10110), see js/31-xcguide.js.
 * connect({host, port}) resolves once connected; every received line comes as a "line" event {line}, the end as "closed" {error}.
 * One connection at a time; connect() again or disconnect() ends the previous one.
 */
@CapacitorPlugin(name = "TcpLine")
public class TcpLinePlugin extends Plugin {
    private Socket sock;
    private int gen = 0;

    @PluginMethod
    public void connect(PluginCall call) {
        final String host = call.getString("host", "127.0.0.1");
        final int port = call.getInt("port", 10110);
        final int g;
        synchronized (this) { g = ++gen; closeSocket(); }
        new Thread(() -> {
            Socket s = new Socket();
            boolean up = false;
            try {
                s.connect(new InetSocketAddress(host, port), 4000);
                s.setKeepAlive(true);
                synchronized (this) {
                    if (g != gen) { s.close(); call.reject("cancelled"); return; }
                    sock = s;
                }
                up = true;
                call.resolve();
                BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.ISO_8859_1));
                String line;
                while ((line = r.readLine()) != null) {
                    if (g != gen) return;
                    JSObject o = new JSObject();
                    o.put("line", line);
                    notifyListeners("line", o);
                }
                closed(g, "closed by the other side");
            } catch (Exception e) {
                if (!up) call.reject(e.getMessage() != null ? e.getMessage() : "cannot connect");
                else closed(g, e.getMessage());
            } finally {
                try { s.close(); } catch (Exception ignored) { }
            }
        }, "TcpLine").start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        synchronized (this) { gen++; closeSocket(); }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (this) { gen++; closeSocket(); }
    }

    private void closed(int g, String why) {
        if (g != gen) return;
        JSObject o = new JSObject();
        o.put("error", why != null ? why : "closed");
        notifyListeners("closed", o);
    }

    private void closeSocket() {
        if (sock != null) { try { sock.close(); } catch (Exception ignored) { } sock = null; }
    }
}
