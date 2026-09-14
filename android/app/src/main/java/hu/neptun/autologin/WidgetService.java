package hu.neptun.autologin;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

// Backs the swipeable StackView on the home-screen widget: builds a small deck [current?, next?]
// from the cached upcoming-class list, recomputed against the clock on every data-set change.
public class WidgetService extends RemoteViewsService {
    private static final Locale HU = new Locale("hu");

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static class Item {
        String label, title, sub;
        Item(String l, String t, String s) { label = l; title = t; sub = s; }
    }

    static class Factory implements RemoteViewsFactory {
        final Context ctx;
        final List<Item> items = new ArrayList<>();
        Factory(Context c) { ctx = c; }

        public void onCreate() {}
        public void onDestroy() {}
        public int getCount() { return items.size(); }
        public long getItemId(int i) { return i; }
        public boolean hasStableIds() { return true; }
        public int getViewTypeCount() { return 1; }
        public RemoteViews getLoadingView() { return null; }

        public void onDataSetChanged() {
            items.clear();
            try {
                SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
                JSONArray arr = new JSONArray(sp.getString("events", "[]"));
                long now = System.currentTimeMillis();
                JSONObject cur = null, next = null;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject e = arr.getJSONObject(i);
                    long s = e.optLong("s"), en = e.optLong("e");
                    if (s <= now && en > now) { if (cur == null) cur = e; }
                    else if (s > now && (next == null || s < next.optLong("s"))) next = e;
                }
                if (cur != null) items.add(toItem(cur, "JELENLEGI ÓRA", now));
                if (next != null) items.add(toItem(next, "KÖVETKEZŐ ÓRA", now));
            } catch (Exception ex) { /* empty deck → StackView shows the empty view */ }
        }

        public RemoteViews getViewAt(int i) {
            Item it = items.get(i);
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_item);
            v.setTextViewText(R.id.w_label, it.label);
            v.setViewVisibility(R.id.w_label, it.label.isEmpty() ? View.GONE : View.VISIBLE);
            v.setTextViewText(R.id.w_title, it.title);
            v.setTextViewText(R.id.w_sub, it.sub);
            v.setViewVisibility(R.id.w_sub, it.sub.isEmpty() ? View.GONE : View.VISIBLE);
            v.setOnClickFillInIntent(R.id.w_item_root, new Intent()); // tap → app (template set on the collection)
            return v;
        }

        private Item toItem(JSONObject e, String label, long now) {
            String title = e.optString("n", "Óra");
            long s = e.optLong("s"), en = e.optLong("e");
            SimpleDateFormat hm = new SimpleDateFormat("HH:mm", HU);
            StringBuilder sb = new StringBuilder();
            if (label.startsWith("KÖVETKEZ")) { String d = dayPrefix(s, now); if (!d.isEmpty()) sb.append(d).append(" · "); }
            sb.append(hm.format(s));
            if (en > 0) sb.append("–").append(hm.format(en));
            String t = e.optString("t", ""), r = e.optString("r", "");
            if (!t.isEmpty()) sb.append(" · ").append(t);
            if (!r.isEmpty()) sb.append(" · ").append(r);
            return new Item(label, title, sb.toString());
        }

        private String dayPrefix(long ts, long now) {
            Calendar a = Calendar.getInstance(); a.setTimeInMillis(ts);
            Calendar b = Calendar.getInstance(); b.setTimeInMillis(now);
            if (a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)) return "";
            return new SimpleDateFormat("EEE", HU).format(ts);
        }
    }
}
