import shell from 'shelljs'

shell.exec('node node_modules/requirejs/bin/r.js -o ' +
           'baseUrl=client ' +
           'cssIn=client/css/him.css ' +
           'out=client_optimized/history.css')
shell.sed('-i', '\\.\\./', '', 'client_optimized/history.css')
shell.sed('-i', 'third_party/', '', 'client_optimized/history.css')

shell.exec('node node_modules/requirejs/bin/r.js -o ' +
           'baseUrl=client/js ' +
           'mainConfigFile=client/js/main.js ' +
           'name=main ' +
           'out=client_optimized/history.js')

shell.cp('client/index.html', 'client_optimized/index.html')
shell.sed('-i', 'js/main\\.js', 'history.js', 'client_optimized/index.html')
shell.sed('-i', 'third_party/require.js', 'require.js', 'client_optimized/index.html')
shell.sed('-i', 'css/him\.css', 'history.css', 'client_optimized/index.html')

shell.cp('-R', 'client/third_party/images', 'client_optimized/images')
shell.cp('-R', 'client/icons', 'client_optimized/icons')
shell.cp('-R', 'client/third_party/jscolor', 'client_optimized/jscolor')

shell.cp('client/third_party/require.js', 'client_optimized/require.js')
