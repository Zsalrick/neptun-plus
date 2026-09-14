package hu.neptun.autologin;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

// "Jelenlegi óra" home-screen widget. Drawing lives in WidgetRender (shared with the next-class one).
public class CurrentClassWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) WidgetRender.render(ctx, mgr, id, true);
    }
}
