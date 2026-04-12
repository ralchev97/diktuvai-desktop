#import <napi.h>
#import <CoreGraphics/CoreGraphics.h>
#import <dispatch/dispatch.h>

/**
 * Native Node addon for detecting the Fn/Globe key on macOS.
 * Uses CGEventTap inside Electron's process (which has Accessibility permission).
 *
 * Fn key detection strategy:
 * 1. flagsChanged with kCGEventFlagMaskSecondaryFn (0x800000) for press/release
 * 2. keyCode 63 in flagsChanged events as Fn identifier
 * 3. Poll timer as safety net — if Fn flag clears without an event, detect release
 */

static Napi::ThreadSafeFunction tsfn;
static bool tsfnActive = false;
static CFMachPortRef eventTap = NULL;
static CFRunLoopSourceRef runLoopSource = NULL;
static CFRunLoopRef tapRunLoop = NULL;
static bool fnDown = false;
static dispatch_source_t pollTimer = NULL;

void notifyJS(bool down) {
    if (tsfnActive) {
        bool* data = new bool(down);
        tsfn.NonBlockingCall(data, [](Napi::Env env, Napi::Function jsCallback, bool* value) {
            jsCallback.Call({Napi::Boolean::New(env, *value)});
            delete value;
        });
    }
}

void checkFnState() {
    // Poll current modifier flags to detect if Fn was released without an event
    CGEventRef event = CGEventCreate(NULL);
    if (event) {
        CGEventFlags flags = CGEventGetFlags(event);
        CFRelease(event);
        bool currentFn = (flags & kCGEventFlagMaskSecondaryFn) != 0;
        if (!currentFn && fnDown) {
            fnDown = false;
            notifyJS(false);
        }
    }
}

CGEventRef eventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void* refcon) {
    if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
        if (eventTap) {
            CGEventTapEnable(eventTap, true);
        }
        return event;
    }

    if (type == kCGEventFlagsChanged) {
        CGEventFlags flags = CGEventGetFlags(event);
        bool currentFn = (flags & kCGEventFlagMaskSecondaryFn) != 0;
        int64_t keyCode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);

        if (currentFn && !fnDown) {
            fnDown = true;
            notifyJS(true);
        } else if (!currentFn && fnDown) {
            fnDown = false;
            notifyJS(false);
        }
        // Also detect Fn release by keyCode 63 specifically
        else if (keyCode == 63 && fnDown && !currentFn) {
            fnDown = false;
            notifyJS(false);
        }
    }

    return event;
}

void startPollTimer() {
    if (pollTimer) return;
    // Poll every 100ms to catch Fn release if the event was swallowed
    pollTimer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0,
                                        dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0));
    dispatch_source_set_timer(pollTimer,
                              dispatch_time(DISPATCH_TIME_NOW, 0),
                              100 * NSEC_PER_MSEC,  // 100ms interval
                              10 * NSEC_PER_MSEC);  // 10ms leeway
    dispatch_source_set_event_handler(pollTimer, ^{
        if (fnDown) {
            checkFnState();
        }
    });
    dispatch_resume(pollTimer);
}

void stopPollTimer() {
    if (pollTimer) {
        dispatch_source_cancel(pollTimer);
        pollTimer = NULL;
    }
}

Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (eventTap != NULL) {
        return Napi::Boolean::New(env, false);
    }

    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback function required").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    tsfn = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "FnKeyCallback",
        0,
        1
    );
    tsfnActive = true;
    fnDown = false;

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        CGEventMask mask = CGEventMaskBit(kCGEventFlagsChanged);

        eventTap = CGEventTapCreate(
            kCGSessionEventTap,
            kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,
            mask,
            eventCallback,
            NULL
        );

        if (!eventTap) {
            fprintf(stderr, "[fn-key] ERROR: Failed to create CGEventTap\n");
            return;
        }

        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
        tapRunLoop = CFRunLoopGetCurrent();
        CFRunLoopAddSource(tapRunLoop, runLoopSource, kCFRunLoopCommonModes);
        CGEventTapEnable(eventTap, true);

        fprintf(stderr, "[fn-key] CGEventTap started\n");
        CFRunLoopRun();
    });

    // Start poll timer as safety net for missed Fn release events
    startPollTimer();

    return Napi::Boolean::New(env, true);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    stopPollTimer();

    if (eventTap != NULL) {
        CGEventTapEnable(eventTap, false);

        if (tapRunLoop) {
            CFRunLoopStop(tapRunLoop);
            tapRunLoop = NULL;
        }

        if (runLoopSource) {
            CFRelease(runLoopSource);
            runLoopSource = NULL;
        }

        CFMachPortInvalidate(eventTap);
        CFRelease(eventTap);
        eventTap = NULL;
        fnDown = false;
    }

    if (tsfnActive) {
        tsfn.Release();
        tsfnActive = false;
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value IsPressed(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), fnDown);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("start", Napi::Function::New(env, Start));
    exports.Set("stop", Napi::Function::New(env, Stop));
    exports.Set("isPressed", Napi::Function::New(env, IsPressed));
    return exports;
}

NODE_API_MODULE(fn_key, Init)
