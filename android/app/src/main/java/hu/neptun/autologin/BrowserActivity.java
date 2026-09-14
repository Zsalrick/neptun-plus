package hu.neptun.autologin;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

// A saját, app-témájú Neptun böngésző. Egy sima WebView + vékony sötét fejléc (vissza · cím ·
// újratöltés · megnyitás rendszerben · bezár) + töltés-csík. A login scriptet minden oldalbetöltés
// után beinjektálja (az önmagát gate-eli), a cookie-k a WebView profiljában megmaradnak.
public class BrowserActivity extends Activity {
    private WebView web;
    private ProgressBar bar;
    private TextView titleView;
    private String injectScript = "";

    private int dp(int v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private TextView iconButton(String glyph, View.OnClickListener onClick) {
        TextView t = new TextView(this);
        t.setText(glyph);
        t.setTextColor(Color.parseColor("#ECEDEE"));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        int p = dp(8);
        t.setPadding(p, p, p, p);
        t.setGravity(Gravity.CENTER);
        t.setOnClickListener(onClick);
        return t;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String url = getIntent().getStringExtra("url");
        injectScript = getIntent().getStringExtra("script");
        if (injectScript == null) injectScript = "";
        String ua = getIntent().getStringExtra("ua");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        root.setBackgroundColor(Color.parseColor("#0E1116"));

        LinearLayout tb = new LinearLayout(this);
        tb.setOrientation(LinearLayout.HORIZONTAL);
        tb.setBackgroundColor(Color.parseColor("#141518"));
        tb.setGravity(Gravity.CENTER_VERTICAL);
        tb.setPadding(dp(6), dp(4), dp(6), dp(4));
        tb.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));

        TextView back = iconButton("‹", v -> { if (web.canGoBack()) web.goBack(); else finish(); });

        titleView = new TextView(this);
        titleView.setTextColor(Color.parseColor("#ECEDEE"));
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        titleView.setText("Neptun");
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, -2, 1f);
        tlp.leftMargin = dp(4);
        tlp.rightMargin = dp(4);
        titleView.setLayoutParams(tlp);

        TextView refresh = iconButton("↻", v -> web.reload());
        TextView openExt = iconButton("↗", v -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(web.getUrl()))); } catch (Exception e) { /* ignore */ }
        });
        TextView close = iconButton("✕", v -> finish());

        tb.addView(back);
        tb.addView(titleView);
        tb.addView(refresh);
        tb.addView(openExt);
        tb.addView(close);

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(3)));

        web = new WebView(this);
        web.setLayoutParams(new LinearLayout.LayoutParams(-1, 0, 1f));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        if (ua != null && ua.length() > 0) s.setUserAgentString(ua);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String u) {
                if (injectScript.length() > 0) { try { view.evaluateJavascript(injectScript, null); } catch (Exception e) { /* ignore */ } }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int p) {
                bar.setProgress(p);
                bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }
            @Override public void onReceivedTitle(WebView view, String t) {
                if (t != null && t.length() > 0 && !t.startsWith("http")) titleView.setText(t);
            }
        });
        web.setDownloadListener(new DownloadListener() {
            @Override public void onDownloadStart(String u, String ua2, String cd, String mt, long len) {
                try {
                    DownloadManager.Request r = new DownloadManager.Request(Uri.parse(u));
                    r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    String cookie = CookieManager.getInstance().getCookie(u);
                    if (cookie != null) r.addRequestHeader("Cookie", cookie);
                    String name = URLUtil.guessFileName(u, cd, mt);
                    r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
                    Toast.makeText(BrowserActivity.this, "Letöltés: " + name, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception e2) { /* ignore */ }
                }
            }
        });

        root.addView(tb);
        root.addView(bar);
        root.addView(web);
        setContentView(root);

        if (url != null && url.length() > 0) web.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        try { if (web != null) { web.loadUrl("about:blank"); web.destroy(); } } catch (Exception e) { /* ignore */ }
        super.onDestroy();
    }
}
