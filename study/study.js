import "webextension-polyfill";
import { Rally } from "@mozilla/rally";
import * as EventHandling from "./EventHandling.js"

async function runStudy() {
    const rally = new Rally();
    await rally.initialize(
        "citp-news-disinfo",
        {
            "crv": "P-256",
            "kid": "citp-news-disinfo-two",
            "kty": "EC",
            "x": "Q20tsJdrryWJeuPXTM27wIPb_YbsdYPpkK2N9O6aXwM",
            "y": "1onW1swaCcN1jkmkIwhXpCm55aMP8GRJln5E8WQKLJk"
        },
        // The following constant is automatically provided by
        // the build system.
        __ENABLE_DEVELOPER_MODE__,
        stateChangeCallback
    ).then(() => { EventHandling.startStudy(rally); });
}

function stateChangeCallback(newState) {
    console.log(newState);
}

runStudy();
