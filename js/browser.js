$(document).ready(function () {
    $.get(
        "/?action=getDocument&documentId=1",
        function (response) {
            window.lastAppliedPatchId = response.last_diff_id;
            window.originalText = response.content;
            $('#text-changed').html(window.originalText);
        }
    );

    setInterval(function () {
        if (!window.flagTextCanged) {
            loadDiffs(1, window.lastAppliedPatchId);
        }
    }, 3000);

    setInterval(function () {
        if (window.flagTextCanged && Date.now()-window.flagTimeCange>1000) {
            window.flagTextCanged = false;
            let dmp = new diff_match_patch();
            let textChanged = $('#text-changed').val();
            let patch = dmp.patch_make(window.originalText, textChanged);
            let patchText = dmp.patch_toText(patch);
            sendDiff(patchText, 1, window.lastAppliedPatchId);
        }
    }, 200);

    $("#text-changed").on(("keydown"), function () {
        window.flagTextCanged = true;
        window.flagTimeCange = Date.now();
    })

    function loadDiffs(documentId, lastAppliedDiffId) {
        let objData = {
            action: "loadDiffs",
            documentId: 1,
            diffId: window.lastAppliedPatchId
        }
        send(objData, handlerSendDiff);
    }

    function sendDiff(patchText, documentId, lastAppliedDiffId) {
        let objData = {
            action: "sendDiff",
            diff: patchText,
            documentId: 1,
            diffId: window.lastAppliedPatchId
        }
        send(objData, handlerSendDiff);
    }

    function applyDiff(originalText, objDiff) {
        let dmp = new diff_match_patch();
        let onePatchDiff = dmp.patch_fromText(objDiff.diff);
        let patchResult = dmp.patch_apply(onePatchDiff, originalText);
        if (patchResult[1][0] === true) {
            originalText= patchResult[0];
            return originalText;
        } else {
            return false;
        }
    }

    function send(objData, collback) {
        $.post(
            "/", objData,
            function (response) {
                if (response.noError === true) {
                    collback(response);
                }
            })

    }


    function handlerSendDiff(response) {
        if (response.noError === true) {
            let diffsList = response.diffsList;
            let noErr = true;
            diffsList.forEach(function (element) {
                if (noErr) {
                    let newText = applyDiff(originalText, element);
                    noErr = newText !== false;
                    if (noErr) {
                        window.originalText = newText;
                        window.lastAppliedPatchId = element.diffId;
                    }else{
                        $.get(
                            "/?action=getDocument&documentId=1",
                            function (response) {
                                window.lastAppliedPatchId = response.last_diff_id;
                                window.originalText = response.content;
                                $('#text-changed').html(window.originalText);
                            }
                        );
                    }
                }
            });
            $('#text-changed').val(window.originalText);
        }
    }
});
