package hu.neptun.autologin;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

// "Megosztás a Kredit+-ba": más appokból (Gmail, Letöltések, fájlkezelő) érkező PDF-ek fogadása.
// A megosztott tartalom-URI olvasási joga csak ideiglenes, ezért a fájlt AZONNAL a saját cache-be
// másoljuk, és a JS a helyi másolatot olvassa be (Capacitor.convertFileSrc). Az eseményt megtartjuk,
// amíg a JS fel nem iratkozik rá, így hidegindításnál sem vész el.
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final long MAX_BYTES = 150L * 1024 * 1024;

    @Override
    public void load() {
        handle(getActivity().getIntent(), true);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handle(intent, false);
    }

    private void handle(Intent intent, boolean coldStart) {
        if (intent == null) return;
        final ArrayList<Uri> uris = sharedUris(intent);
        if (uris.isEmpty()) return;
        // Ne dolgozzuk fel újra ugyanazt, ha az activity újraépül (pl. elforgatás).
        if (coldStart) getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        final String type = intent.getType();
        new Thread(() -> {
            JSArray files = new JSArray();
            File dir = new File(getContext().getCacheDir(), "shared");
            clearDir(dir);
            dir.mkdirs();
            for (Uri uri : uris) {
                try {
                    JSObject f = copyToCache(uri, dir, type);
                    if (f != null) files.put(f);
                } catch (Exception e) {
                    // egy hibás fájl ne akassza meg a többit
                }
            }
            JSObject data = new JSObject();
            data.put("files", files);
            data.put("count", files.length());
            getActivity().runOnUiThread(() -> notifyListeners("shared", data, true));
        }).start();
    }

    @SuppressWarnings("deprecation")
    private ArrayList<Uri> sharedUris(Intent intent) {
        ArrayList<Uri> out = new ArrayList<>();
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = Build.VERSION.SDK_INT >= 33 ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class) : (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) out.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = Build.VERSION.SDK_INT >= 33 ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class) : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) out.addAll(list);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            if (intent.getData() != null) out.add(intent.getData());
        }
        // Néhány app csak a ClipData-ban adja át a fájlt.
        if (out.isEmpty() && (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action))) {
            ClipData clip = intent.getClipData();
            if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) { Uri u = clip.getItemAt(i).getUri(); if (u != null) out.add(u); }
        }
        return out;
    }

    private JSObject copyToCache(Uri uri, File dir, String intentType) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        String name = null;
        long size = -1;
        try (Cursor c = cr.query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME), si = c.getColumnIndex(OpenableColumns.SIZE);
                if (ni >= 0) name = c.getString(ni);
                if (si >= 0 && !c.isNull(si)) size = c.getLong(si);
            }
        } catch (Exception ignore) { }
        if (name == null || name.trim().isEmpty()) name = uri.getLastPathSegment() != null ? uri.getLastPathSegment() : "dokumentum.pdf";
        String mime = cr.getType(uri);
        if (mime == null) mime = intentType;
        boolean isPdf = "application/pdf".equals(mime) || name.toLowerCase().endsWith(".pdf");
        if (!isPdf) return null;
        if (size > MAX_BYTES) return null;
        String safe = name.replaceAll("[^\\p{L}\\p{N}._ -]", "_");
        if (!safe.toLowerCase().endsWith(".pdf")) safe = safe + ".pdf";
        File out = new File(dir, System.currentTimeMillis() + "_" + safe);
        long total = 0;
        try (InputStream in = cr.openInputStream(uri); OutputStream os = new FileOutputStream(out)) {
            if (in == null) return null;
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_BYTES) { os.close(); out.delete(); return null; }
                os.write(buf, 0, n);
            }
        }
        JSObject f = new JSObject();
        f.put("path", out.getAbsolutePath());
        f.put("name", name);
        f.put("size", total);
        f.put("mime", "application/pdf");
        return f;
    }

    // A JS a beolvasás után hívja: a cache-ben lévő másolatok törlése.
    @PluginMethod
    public void clear(PluginCall call) {
        clearDir(new File(getContext().getCacheDir(), "shared"));
        call.resolve();
    }

    private static void clearDir(File dir) {
        File[] list = dir.listFiles();
        if (list != null) for (File f : list) f.delete();
    }
}
