package com.ccas.churchapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Load from server URL for latest version
        bridge.getWebView().loadUrl("https://ccac-api.ccac-church.workers.dev");
    }
}
