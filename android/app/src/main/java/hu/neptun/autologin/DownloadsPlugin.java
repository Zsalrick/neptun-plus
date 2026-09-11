package hu.neptun.autologin;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

// Saves a base64 blob into the phone's public Downloads folder (MediaStore on API 29+, legacy path
// below that) and can open a saved file with the system viewer. Used by the Üzenetek attachment flow.
@CapacitorPlugin(name = "Downloads")
public class DownloadsPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String b64 = call.getString("base64", "");
        String fileName = call.getString("fileName", "melleklet");
        String mime = call.getString("mime", "application/octet-stream");
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            String uriStr;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri item = getContext().getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (item == null) { call.reject("insert failed"); return; }
                OutputStream os = getContext().getContentResolver().openOutputStream(item);
                os.write(bytes); os.flush(); os.close();
                cv.clear();
                cv.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(item, cv, null, null);
                uriStr = item.toString();
            } else {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, fileName);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(bytes); fos.flush(); fos.close();
                uriStr = FileProvider.getUriForFile(getContext(),
                        getContext().getPackageName() + ".fileprovider", f).toString();
            }
            JSObject ret = new JSObject();
            ret.put("uri", uriStr);
            ret.put("name", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "save failed" : e.getMessage());
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String uri = call.getString("uri", "");
        String mime = call.getString("mime", "*/*");
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(Uri.parse(uri), mime);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "open failed" : e.getMessage());
        }
    }
}
