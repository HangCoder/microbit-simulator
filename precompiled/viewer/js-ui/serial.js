(function() {
    var terminal = new Terminal({
        scrollback: 1000000
    });
    terminal.open(document.querySelector('#output'));

    window.terminal = terminal;

    window.MbedJSHal.serial.on('stdout', function(c) {
        if (typeof c === 'number') {
            c = String.fromCharCode(c);
        }
        // used to communicate back to Puppeteer (see cli.js)
        if (typeof window.onPrintEvent === 'function') {
            window.onPrintEvent(c);
        }

        // should be handled by Mbed OS, but it isn't...
        if (c === '\n') {
            terminal.write('\r');
        }

        terminal.write(c);
    });

    function stdin(e) {
        for (var i = 0; i < e.length; i++) {
          window.MbedJSHal.serial.onStdIn(e.charCodeAt(i));
        }
    }

    window.MbedJSHal.serial.on('stdout-line', function(l) {
        if (typeof window.onPrintEvent === 'function') {
            window.onPrintEvent(l);
        }

        terminal.write(l);
    });

    terminal.on('key', stdin);
})();
