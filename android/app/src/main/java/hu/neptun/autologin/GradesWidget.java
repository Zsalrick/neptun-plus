package hu.neptun.autologin;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

// "Kreditindex" home-screen stat widget. Drawing lives in WidgetRender (shared stat layout).
public class GradesWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) WidgetRender.renderStat(ctx, mgr, id, "credit");
    }
}
