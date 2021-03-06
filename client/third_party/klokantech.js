// Fetched from https://maptilercdn.s3.amazonaws.com/klokantech.js on 29 July 2014.
// Unminified by jsbeautifier.org.
// Wrapped as a RequireJS module.

define(['googlemaps'], function(google) {

function f(a) {
    throw a;
}
var i = void 0,
    j = !0,
    l = null,
    n = !1;

function aa(a) {
    return function() {
        return this[a]
    }
}
var o, p = this;

function ba() {}

function ca(a) {
    var b = typeof a;
    if ("object" == b)
        if (a) {
            if (a instanceof Array) return "array";
            if (a instanceof Object) return b;
            var c = Object.prototype.toString.call(a);
            if ("[object Window]" == c) return "object";
            if ("[object Array]" == c || "number" == typeof a.length && "undefined" != typeof a.splice && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("splice")) return "array";
            if ("[object Function]" == c || "undefined" != typeof a.call && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("call")) return "function"
        } else return "null";
    else if ("function" == b && "undefined" == typeof a.call) return "object";
    return b
}

function r(a) {
    return a !== i
}

function t(a) {
    return "array" == ca(a)
}

function da(a) {
    var b = ca(a);
    return "array" == b || "object" == b && "number" == typeof a.length
}

function u(a) {
    return "string" == typeof a
}

function v(a) {
    return "function" == ca(a)
}

function ea(a) {
    var b = typeof a;
    return "object" == b && a != l || "function" == b
}

function w(a) {
    return a[fa] || (a[fa] = ++ga)
}
var fa = "closure_uid_" + Math.floor(2147483648 * Math.random()).toString(36),
    ga = 0;

function ha(a, b, c) {
    return a.call.apply(a.bind, arguments)
}

function ia(a, b, c) {
    a || f(Error());
    if (2 < arguments.length) {
        var d = Array.prototype.slice.call(arguments, 2);
        return function() {
            var c = Array.prototype.slice.call(arguments);
            Array.prototype.unshift.apply(c, d);
            return a.apply(b, c)
        }
    }
    return function() {
        return a.apply(b, arguments)
    }
}

function x(a, b, c) {
    x = Function.prototype.bind && -1 != Function.prototype.bind.toString().indexOf("native code") ? ha : ia;
    return x.apply(l, arguments)
}
var y = Date.now || function() {
    return +new Date
};

function z(a, b) {
    var c = a.split("."),
        d = p;
    !(c[0] in d) && d.execScript && d.execScript("var " + c[0]);
    for (var e; c.length && (e = c.shift());)!c.length && r(b) ? d[e] = b : d = d[e] ? d[e] : d[e] = {}
}

function A(a, b) {
    function c() {}
    c.prototype = b.prototype;
    a.e = b.prototype;
    a.prototype = new c
};

function ja(a) {
    if (!ka.test(a)) return a; - 1 != a.indexOf("&") && (a = a.replace(la, "&amp;")); - 1 != a.indexOf("<") && (a = a.replace(ma, "&lt;")); - 1 != a.indexOf(">") && (a = a.replace(na, "&gt;")); - 1 != a.indexOf('"') && (a = a.replace(oa, "&quot;"));
    return a
}
var la = /&/g,
    ma = /</g,
    na = />/g,
    oa = /\"/g,
    ka = /[&<>\"]/;
var B = Array.prototype,
    pa = B.indexOf ? function(a, b, c) {
        return B.indexOf.call(a, b, c)
    } : function(a, b, c) {
        c = c == l ? 0 : 0 > c ? Math.max(0, a.length + c) : c;
        if (u(a)) return !u(b) || 1 != b.length ? -1 : a.indexOf(b, c);
        for (; c < a.length; c++)
            if (c in a && a[c] === b) return c;
        return -1
    },
    qa = B.forEach ? function(a, b, c) {
        B.forEach.call(a, b, c)
    } : function(a, b, c) {
        for (var d = a.length, e = u(a) ? a.split("") : a, g = 0; g < d; g++) g in e && b.call(c, e[g], g, a)
    };

function ra(a, b) {
    var c = pa(a, b);
    0 <= c && B.splice.call(a, c, 1)
}

function sa(a) {
    return B.concat.apply(B, arguments)
}

function ta(a) {
    if (t(a)) return sa(a);
    for (var b = [], c = 0, d = a.length; c < d; c++) b[c] = a[c];
    return b
}

function ua(a, b, c, d) {
    B.splice.apply(a, va(arguments, 1))
}

function va(a, b, c) {
    return 2 >= arguments.length ? B.slice.call(a, b) : B.slice.call(a, b, c)
};
var wa, xa, ya, za, C;

function Aa() {
    return p.navigator ? p.navigator.userAgent : l
}
za = ya = xa = wa = n;
var Ba;
if (Ba = Aa()) {
    var Ca = p.navigator;
    wa = 0 == Ba.indexOf("Opera");
    xa = !wa && -1 != Ba.indexOf("MSIE");
    ya = !wa && -1 != Ba.indexOf("WebKit");
    za = !wa && !ya && "Gecko" == Ca.product
}
var Da = wa,
    E = xa,
    F = za,
    G = ya,
    Ea, Fa = p.navigator;
Ea = Fa && Fa.platform || "";
C = -1 != Ea.indexOf("Mac");
var Ga = -1 != Ea.indexOf("Win"),
    Ha;
a: {
    var Ia = "",
        Ja;
    if (Da && p.opera) var La = p.opera.version,
        Ia = "function" == typeof La ? La() : La;
    else if (F ? Ja = /rv\:([^\);]+)(\)|;)/ : E ? Ja = /MSIE\s+([^\);]+)(\)|;)/ : G && (Ja = /WebKit\/(\S+)/), Ja) var Ma = Ja.exec(Aa()),
        Ia = Ma ? Ma[1] : "";
    if (E) {
        var Na, Oa = p.document;
        Na = Oa ? Oa.documentMode : i;
        if (Na > parseFloat(Ia)) {
            Ha = "" + Na;
            break a
        }
    }
    Ha = Ia
}
var Pa = {};

function H(a) {
    var b;
    if (!(b = Pa[a])) {
        b = 0;
        for (var c = ("" + Ha).replace(/^[\s\xa0]+|[\s\xa0]+$/g, "").split("."), d = ("" + a).replace(/^[\s\xa0]+|[\s\xa0]+$/g, "").split("."), e = Math.max(c.length, d.length), g = 0; 0 == b && g < e; g++) {
            var h = c[g] || "",
                k = d[g] || "",
                m = RegExp("(\\d*)(\\D*)", "g"),
                s = RegExp("(\\d*)(\\D*)", "g");
            do {
                var D = m.exec(h) || ["", "", ""],
                    q = s.exec(k) || ["", "", ""];
                if (0 == D[0].length && 0 == q[0].length) break;
                b = ((0 == D[1].length ? 0 : parseInt(D[1], 10)) < (0 == q[1].length ? 0 : parseInt(q[1], 10)) ? -1 : (0 == D[1].length ? 0 : parseInt(D[1],
                    10)) > (0 == q[1].length ? 0 : parseInt(q[1], 10)) ? 1 : 0) || ((0 == D[2].length) < (0 == q[2].length) ? -1 : (0 == D[2].length) > (0 == q[2].length) ? 1 : 0) || (D[2] < q[2] ? -1 : D[2] > q[2] ? 1 : 0)
            } while (0 == b)
        }
        b = Pa[a] = 0 <= b
    }
    return b
}
var Qa = {};

function I(a) {
    return Qa[a] || (Qa[a] = E && !!document.documentMode && document.documentMode >= a)
};
var Ra, Sa = !E || I(9);
!F && !E || E && I(9) || F && H("1.9.1");
E && H("9");

function Ta(a) {
    return (a = a.className) && "function" == typeof a.split ? a.split(/\s+/) : []
}

function Ua(a, b) {
    var c = Ta(a),
        d = va(arguments, 1),
        e;
    e = c;
    for (var g = 0, h = 0; h < d.length; h++) 0 <= pa(e, d[h]) || (e.push(d[h]), g++);
    e = g == d.length;
    a.className = c.join(" ");
    return e
}

function Va(a, b) {
    for (var c = Ta(a), d = va(arguments, 1), e = c, g = 0, h = 0; h < e.length; h++) 0 <= pa(d, e[h]) && (ua(e, h--, 1), g++);
    a.className = c.join(" ")
};

function Wa(a, b) {
    this.x = r(a) ? a : 0;
    this.y = r(b) ? b : 0
};

function Xa(a, b, c) {
    for (var d in a) b.call(c, a[d], d, a)
}

function Ya() {
    var a = Za,
        b;
    for (b in a) return n;
    return j
}
var $a = "constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",");

function ab(a, b) {
    for (var c, d, e = 1; e < arguments.length; e++) {
        d = arguments[e];
        for (c in d) a[c] = d[c];
        for (var g = 0; g < $a.length; g++) c = $a[g], Object.prototype.hasOwnProperty.call(d, c) && (a[c] = d[c])
    }
};

function J(a) {
    return a ? new bb(L(a)) : Ra || (Ra = new bb)
}

function cb(a, b) {
    Xa(b, function(b, d) {
        "style" == d ? a.style.cssText = b : "class" == d ? a.className = b : "for" == d ? a.htmlFor = b : d in db ? a.setAttribute(db[d], b) : 0 == d.lastIndexOf("aria-", 0) ? a.setAttribute(d, b) : a[d] = b
    })
}
var db = {
    cellpadding: "cellPadding",
    cellspacing: "cellSpacing",
    colspan: "colSpan",
    rowspan: "rowSpan",
    valign: "vAlign",
    height: "height",
    width: "width",
    usemap: "useMap",
    frameborder: "frameBorder",
    maxlength: "maxLength",
    type: "type"
};

function eb(a, b, c) {
    return fb(document, arguments)
}

function fb(a, b) {
    var c = b[0],
        d = b[1];
    if (!Sa && d && (d.name || d.type)) {
        c = ["<", c];
        d.name && c.push(' name="', ja(d.name), '"');
        if (d.type) {
            c.push(' type="', ja(d.type), '"');
            var e = {};
            ab(e, d);
            d = e;
            delete d.type
        }
        c.push(">");
        c = c.join("")
    }
    c = a.createElement(c);
    d && (u(d) ? c.className = d : t(d) ? Ua.apply(l, [c].concat(d)) : cb(c, d));
    2 < b.length && gb(a, c, b);
    return c
}

function gb(a, b, c) {
    function d(c) {
        c && b.appendChild(u(c) ? a.createTextNode(c) : c)
    }
    for (var e = 2; e < c.length; e++) {
        var g = c[e];
        da(g) && !(ea(g) && 0 < g.nodeType) ? qa(hb(g) ? ta(g) : g, d) : d(g)
    }
}

function ib(a) {
    a && a.parentNode && a.parentNode.removeChild(a)
}

function jb(a, b) {
    if (a.contains && 1 == b.nodeType) return a == b || a.contains(b);
    if ("undefined" != typeof a.compareDocumentPosition) return a == b || Boolean(a.compareDocumentPosition(b) & 16);
    for (; b && a != b;) b = b.parentNode;
    return b == a
}

function L(a) {
    return 9 == a.nodeType ? a : a.ownerDocument || a.document
}

function hb(a) {
    if (a && "number" == typeof a.length) {
        if (ea(a)) return "function" == typeof a.item || "string" == typeof a.item;
        if (v(a)) return "function" == typeof a.item
    }
    return n
}

function bb(a) {
    this.r = a || p.document || document
}
o = bb.prototype;
o.Na = J;
o.b = function(a) {
    return u(a) ? this.r.getElementById(a) : a
};
o.ja = function(a, b, c) {
    return fb(this.r, arguments)
};
o.createElement = function(a) {
    return this.r.createElement(a)
};
o.createTextNode = function(a) {
    return this.r.createTextNode(a)
};

function kb(a) {
    var b = a.r,
        a = !G && "CSS1Compat" == b.compatMode ? b.documentElement : b.body,
        b = b.parentWindow || b.defaultView;
    return new Wa(b.pageXOffset || a.scrollLeft, b.pageYOffset || a.scrollTop)
}
o.appendChild = function(a, b) {
    a.appendChild(b)
};
o.contains = jb;

function lb(a, b, c) {
    return Math.min(Math.max(a, b), c)
};

function mb(a, b, c, d) {
    this.left = a;
    this.top = b;
    this.width = c;
    this.height = d
}
mb.prototype.intersects = function(a) {
    return this.left <= a.left + a.width && a.left <= this.left + this.width && this.top <= a.top + a.height && a.top <= this.top + this.height
};
mb.prototype.contains = function(a) {
    return a instanceof mb ? this.left <= a.left && this.left + this.width >= a.left + a.width && this.top <= a.top && this.top + this.height >= a.top + a.height : a.x >= this.left && a.x <= this.left + this.width && a.y >= this.top && a.y <= this.top + this.height
};

function nb(a) {
    var b;
    a: {
        b = L(a);
        if (b.defaultView && b.defaultView.getComputedStyle && (b = b.defaultView.getComputedStyle(a, l))) {
            b = b.position || b.getPropertyValue("position");
            break a
        }
        b = ""
    }
    return b || (a.currentStyle ? a.currentStyle.position : l) || a.style && a.style.position
}

function ob(a) {
    var b = a.getBoundingClientRect();
    E && (a = a.ownerDocument, b.left -= a.documentElement.clientLeft + a.body.clientLeft, b.top -= a.documentElement.clientTop + a.body.clientTop);
    return b
}

function pb(a) {
    if (E && !I(8)) return a.offsetParent;
    for (var b = L(a), c = nb(a), d = "fixed" == c || "absolute" == c, a = a.parentNode; a && a != b; a = a.parentNode)
        if (c = nb(a), d = d && "static" == c && a != b.documentElement && a != b.body, !d && (a.scrollWidth > a.clientWidth || a.scrollHeight > a.clientHeight || "fixed" == c || "absolute" == c || "relative" == c)) return a;
    return l
}

function qb(a) {
    var b = new Wa;
    if (1 == a.nodeType)
        if (a.getBoundingClientRect) a = ob(a), b.x = a.left, b.y = a.top;
        else {
            var c = kb(J(a));
            var d, e = L(a),
                g = nb(a),
                h = F && e.getBoxObjectFor && !a.getBoundingClientRect && "absolute" == g && (d = e.getBoxObjectFor(a)) && (0 > d.screenX || 0 > d.screenY),
                k = new Wa(0, 0),
                m;
            d = e ? 9 == e.nodeType ? e : L(e) : document;
            if (m = E)
                if (m = !I(9)) m = "CSS1Compat" != J(d).r.compatMode;
            m = m ? d.body : d.documentElement;
            if (a != m)
                if (a.getBoundingClientRect) d = ob(a), a = kb(J(e)), k.x = d.left + a.x, k.y = d.top + a.y;
                else if (e.getBoxObjectFor &&
                !h) d = e.getBoxObjectFor(a), a = e.getBoxObjectFor(m), k.x = d.screenX - a.screenX, k.y = d.screenY - a.screenY;
            else {
                h = a;
                do {
                    k.x += h.offsetLeft;
                    k.y += h.offsetTop;
                    h != a && (k.x += h.clientLeft || 0, k.y += h.clientTop || 0);
                    if (G && "fixed" == nb(h)) {
                        k.x += e.body.scrollLeft;
                        k.y += e.body.scrollTop;
                        break
                    }
                    h = h.offsetParent
                } while (h && h != a);
                if (Da || G && "absolute" == g) k.y -= e.body.offsetTop;
                for (h = a;
                    (h = pb(h)) && h != e.body && h != m;)
                    if (k.x -= h.scrollLeft, !Da || "TR" != h.tagName) k.y -= h.scrollTop
            }
            b.x = k.x - c.x;
            b.y = k.y - c.y
        } else c = v(a.Db), k = a, a.targetTouches ? k = a.targetTouches[0] :
        c && a.s.targetTouches && (k = a.s.targetTouches[0]), b.x = k.clientX, b.y = k.clientY;
    return b
}

function rb(a, b) {
    var c = a.style;
    "opacity" in c ? c.opacity = b : "MozOpacity" in c ? c.MozOpacity = b : "filter" in c && (c.filter = "" === b ? "" : "alpha(opacity=" + 100 * b + ")")
};

function M(a, b, c, d, e) {
    this.map = a;
    this.yb = b;
    this.bounds = c || new google.maps.LatLngBounds(new google.maps.LatLng(-88, -179.999999999), new google.maps.LatLng(88, 180));
    this.minZoom = d || 0;
    this.F = e || 21;
    this.tileSize = new google.maps.Size(256, 256);
    this.opacity = 1;
    this.map.overlayMapTypes.insertAt(0, this);
    this.cb = x(function(a, b, c) {
        var d = this.map.getProjection(),
            e = Math.pow(2, a),
            a = 256 / e,
            e = 256 / e;
        return new google.maps.LatLngBounds(d.fromPointToLatLng(new google.maps.Point(b * a, (c + 1) * e)), d.fromPointToLatLng(new google.maps.Point((b +
            1) * a, c * e)))
    }, this);
    this.La = [];
    b = x(function(a) {
        this.La[a] = new google.maps.ImageMapType({
            getTileUrl: x(function(b, c) {
                if (c != this.F + a) return "";
                var d = 1 << this.F,
                    d = (b.x % d + d) % d;
                return this.bounds.intersects(this.cb(this.F, d, b.y)) ? this.yb(d, b.y, this.F) : "https://maptilercdn.s3.amazonaws.com/none.png"
            }, this),
            tileSize: new google.maps.Size(256 << a, 256 << a),
            maxZoom: this.F + a,
            minZoom: this.F + a,
            opacity: 1
        });
        return this.La[a]
    }, this);
    for (c = 1; c <= 21 - this.F; c++) a.overlayMapTypes.insertAt(0, b(c));
    this.tiles = {}
}
o = M.prototype;
o.tileSize = new google.maps.Size(256, 256);
o.maxZoom = 21;
o.getTile = function(a, b) {
    var c = 1 << b,
        d = (a.x % c + c) % c,
        e = a.y;
    return this.minZoom <= b && b <= this.F && 0 <= e && e < c && this.bounds.intersects(this.cb(b, d, e)) ? (c = eb("img", {
        src: this.yb(d, e, b),
        width: this.tileSize.width + "px",
        height: this.tileSize.height + "px",
        onerror: function() {
            this.src = "https://maptilercdn.s3.amazonaws.com/none.png";
            return j
        }
    }), rb(c, this.opacity), d = b + "_" + a.x + "_" + a.y, this.tiles[d] = c, c.tileKey = d, c) : document.createElement("div")
};
o.releaseTile = function(a) {
    delete this.tiles[a.tileKey];
    for (var b; b = a.firstChild;) a.removeChild(b);
    ib(a)
};
o.Sb = function(a) {
    this.opacity = a;
    Xa(this.tiles, function(a) {
        a != l && rb(a, this.opacity)
    }, this);
    for (a = 1; a <= 21 - this.F; a++) this.La[a].setOpacity(this.opacity)
};
z("klokantech.MapTilerMapType", M);
z("klokantech.MapTilerMapType.prototype.tileSize", M.prototype.tileSize);
z("klokantech.MapTilerMapType.prototype.maxZoom", M.prototype.maxZoom);
z("klokantech.MapTilerMapType.prototype.getTile", M.prototype.getTile);
z("klokantech.MapTilerMapType.prototype.releaseTile", M.prototype.releaseTile);
z("klokantech.MapTilerMapType.prototype.setOpacity", M.prototype.Sb);

function sb() {}
sb.prototype.$a = n;
sb.prototype.i = function() {
    this.$a || (this.$a = j, this.d())
};
sb.prototype.d = function() {
    this.Ab && tb.apply(l, this.Ab)
};

function tb(a) {
    for (var b = 0, c = arguments.length; b < c; ++b) {
        var d = arguments[b];
        da(d) ? tb.apply(l, d) : d && "function" == typeof d.i && d.i()
    }
};
var ub = !E || I(9),
    vb = !E || I(9),
    wb = E && !H("8");
!G || H("528");
F && H("1.9b") || E && H("8") || Da && H("9.5") || G && H("528");
!F || H("8");

function N(a, b) {
    this.type = a;
    this.currentTarget = this.target = b
}
A(N, sb);
N.prototype.d = function() {
    delete this.type;
    delete this.target;
    delete this.currentTarget
};
N.prototype.ea = n;
N.prototype.oa = j;
N.prototype.preventDefault = function() {
    this.oa = n
};

function xb(a) {
    a.preventDefault()
};

function yb(a) {
    yb[" "](a);
    return a
}
yb[" "] = ba;

function O(a, b) {
    a && this.K(a, b)
}
A(O, N);
var zb = [1, 4, 2];
o = O.prototype;
o.target = l;
o.relatedTarget = l;
o.offsetX = 0;
o.offsetY = 0;
o.clientX = 0;
o.clientY = 0;
o.screenX = 0;
o.screenY = 0;
o.button = 0;
o.keyCode = 0;
o.charCode = 0;
o.ctrlKey = n;
o.altKey = n;
o.shiftKey = n;
o.metaKey = n;
o.s = l;
o.K = function(a, b) {
    var c = this.type = a.type;
    N.call(this, c);
    this.target = a.target || a.srcElement;
    this.currentTarget = b;
    var d = a.relatedTarget;
    if (d) {
        if (F) {
            var e;
            a: {
                try {
                    yb(d.nodeName);
                    e = j;
                    break a
                } catch (g) {}
                e = n
            }
            e || (d = l)
        }
    } else "mouseover" == c ? d = a.fromElement : "mouseout" == c && (d = a.toElement);
    this.relatedTarget = d;
    this.offsetX = G || a.offsetX !== i ? a.offsetX : a.layerX;
    this.offsetY = G || a.offsetY !== i ? a.offsetY : a.layerY;
    this.clientX = a.clientX !== i ? a.clientX : a.pageX;
    this.clientY = a.clientY !== i ? a.clientY : a.pageY;
    this.screenX = a.screenX ||
        0;
    this.screenY = a.screenY || 0;
    this.button = a.button;
    this.keyCode = a.keyCode || 0;
    this.charCode = a.charCode || ("keypress" == c ? a.keyCode : 0);
    this.ctrlKey = a.ctrlKey;
    this.altKey = a.altKey;
    this.shiftKey = a.shiftKey;
    this.metaKey = a.metaKey;
    this.state = a.state;
    this.s = a;
    delete this.oa;
    delete this.ea
};
o.preventDefault = function() {
    O.e.preventDefault.call(this);
    var a = this.s;
    if (a.preventDefault) a.preventDefault();
    else if (a.returnValue = n, wb) try {
        if (a.ctrlKey || 112 <= a.keyCode && 123 >= a.keyCode) a.keyCode = -1
    } catch (b) {}
};
o.Db = aa("s");
o.d = function() {
    O.e.d.call(this);
    this.relatedTarget = this.currentTarget = this.target = this.s = l
};

function Ab() {}
var Bb = 0;
o = Ab.prototype;
o.key = 0;
o.U = n;
o.Ya = n;
o.K = function(a, b, c, d, e, g) {
    v(a) ? this.lb = j : a && a.handleEvent && v(a.handleEvent) ? this.lb = n : f(Error("Invalid listener argument"));
    this.aa = a;
    this.tb = b;
    this.src = c;
    this.type = d;
    this.capture = !!e;
    this.wa = g;
    this.Ya = n;
    this.key = ++Bb;
    this.U = n
};
o.handleEvent = function(a) {
    return this.lb ? this.aa.call(this.wa || this.src, a) : this.aa.handleEvent.call(this.aa, a)
};
var Cb = {},
    P = {},
    Q = {},
    Db = {};

function R(a, b, c, d, e) {
    if (b) {
        if (t(b)) {
            for (var g = 0; g < b.length; g++) R(a, b[g], c, d, e);
            return l
        }
        var d = !!d,
            h = P;
        b in h || (h[b] = {
            z: 0,
            v: 0
        });
        h = h[b];
        d in h || (h[d] = {
            z: 0,
            v: 0
        }, h.z++);
        var h = h[d],
            k = w(a),
            m;
        h.v++;
        if (h[k]) {
            m = h[k];
            for (g = 0; g < m.length; g++)
                if (h = m[g], h.aa == c && h.wa == e) {
                    if (h.U) break;
                    return m[g].key
                }
        } else m = h[k] = [], h.z++;
        g = Eb();
        g.src = a;
        h = new Ab;
        h.K(c, g, a, b, d, e);
        c = h.key;
        g.key = c;
        m.push(h);
        Cb[c] = h;
        Q[k] || (Q[k] = []);
        Q[k].push(h);
        a.addEventListener ? (a == p || !a.Za) && a.addEventListener(b, g, d) : a.attachEvent(b in Db ? Db[b] :
            Db[b] = "on" + b, g);
        return c
    }
    f(Error("Invalid event type"))
}

function Eb() {
    var a = Fb,
        b = vb ? function(c) {
            return a.call(b.src, b.key, c)
        } : function(c) {
            c = a.call(b.src, b.key, c);
            if (!c) return c
        };
    return b
}

function Gb(a, b, c, d, e) {
    if (t(b))
        for (var g = 0; g < b.length; g++) Gb(a, b[g], c, d, e);
    else if (d = !!d, a = Hb(a, b, d))
        for (g = 0; g < a.length; g++)
            if (a[g].aa == c && a[g].capture == d && a[g].wa == e) {
                S(a[g].key);
                break
            }
}

function S(a) {
    if (!Cb[a]) return n;
    var b = Cb[a];
    if (b.U) return n;
    var c = b.src,
        d = b.type,
        e = b.tb,
        g = b.capture;
    c.removeEventListener ? (c == p || !c.Za) && c.removeEventListener(d, e, g) : c.detachEvent && c.detachEvent(d in Db ? Db[d] : Db[d] = "on" + d, e);
    c = w(c);
    e = P[d][g][c];
    if (Q[c]) {
        var h = Q[c];
        ra(h, b);
        0 == h.length && delete Q[c]
    }
    b.U = j;
    e.sb = j;
    Ib(d, g, c, e);
    delete Cb[a];
    return j
}

function Ib(a, b, c, d) {
    if (!d.Da && d.sb) {
        for (var e = 0, g = 0; e < d.length; e++) d[e].U ? d[e].tb.src = l : (e != g && (d[g] = d[e]), g++);
        d.length = g;
        d.sb = n;
        0 == g && (delete P[a][b][c], P[a][b].z--, 0 == P[a][b].z && (delete P[a][b], P[a].z--), 0 == P[a].z && delete P[a])
    }
}

function Jb(a) {
    var b, c = 0,
        d = b == l;
    b = !!b;
    if (a == l) Xa(Q, function(a) {
        for (var e = a.length - 1; 0 <= e; e--) {
            var g = a[e];
            if (d || b == g.capture) S(g.key), c++
        }
    });
    else if (a = w(a), Q[a])
        for (var a = Q[a], e = a.length - 1; 0 <= e; e--) {
            var g = a[e];
            if (d || b == g.capture) S(g.key), c++
        }
}

function Hb(a, b, c) {
    var d = P;
    return b in d && (d = d[b], c in d && (d = d[c], a = w(a), d[a])) ? d[a] : l
}

function Kb(a, b, c, d, e) {
    var g = 1,
        b = w(b);
    if (a[b]) {
        a.v--;
        a = a[b];
        a.Da ? a.Da++ : a.Da = 1;
        try {
            for (var h = a.length, k = 0; k < h; k++) {
                var m = a[k];
                m && !m.U && (g &= Lb(m, e) !== n)
            }
        } finally {
            a.Da--, Ib(c, d, b, a)
        }
    }
    return Boolean(g)
}

function Lb(a, b) {
    var c = a.handleEvent(b);
    a.Ya && S(a.key);
    return c
}

function Fb(a, b) {
    if (!Cb[a]) return j;
    var c = Cb[a],
        d = c.type,
        e = P;
    if (!(d in e)) return j;
    var e = e[d],
        g, h;
    if (!vb) {
        var k;
        if (!(k = b)) a: {
            k = ["window", "event"];
            for (var m = p; g = k.shift();)
                if (m[g] != l) m = m[g];
                else {
                    k = l;
                    break a
                }
            k = m
        }
        g = k;
        k = j in e;
        m = n in e;
        if (k) {
            if (0 > g.keyCode || g.returnValue != i) return j;
            a: {
                var s = n;
                if (0 == g.keyCode) try {
                    g.keyCode = -1;
                    break a
                } catch (D) {
                    s = j
                }
                if (s || g.returnValue == i) g.returnValue = j
            }
        }
        s = new O;
        s.K(g, this);
        g = j;
        try {
            if (k) {
                for (var q = [], Ka = s.currentTarget; Ka; Ka = Ka.parentNode) q.push(Ka);
                h = e[j];
                h.v = h.z;
                for (var K =
                    q.length - 1; !s.ea && 0 <= K && h.v; K--) s.currentTarget = q[K], g &= Kb(h, q[K], d, j, s);
                if (m) {
                    h = e[n];
                    h.v = h.z;
                    for (K = 0; !s.ea && K < q.length && h.v; K++) s.currentTarget = q[K], g &= Kb(h, q[K], d, n, s)
                }
            } else g = Lb(c, s)
        } finally {
            q && (q.length = 0), s.i()
        }
        return g
    }
    d = new O(b, this);
    try {
        g = Lb(c, d)
    } finally {
        d.i()
    }
    return g
};

function T() {}
A(T, sb);
o = T.prototype;
o.Za = j;
o.Fa = l;
o.Ta = function(a) {
    this.Fa = a
};
o.addEventListener = function(a, b, c, d) {
    R(this, a, b, c, d)
};
o.removeEventListener = function(a, b, c, d) {
    Gb(this, a, b, c, d)
};
o.dispatchEvent = function(a) {
    var b = a.type || a,
        c = P;
    if (b in c) {
        if (u(a)) a = new N(a, this);
        else if (a instanceof N) a.target = a.target || this;
        else {
            var d = a,
                a = new N(b, this);
            ab(a, d)
        }
        var d = 1,
            e, c = c[b],
            b = j in c,
            g;
        if (b) {
            e = [];
            for (g = this; g; g = g.Fa) e.push(g);
            g = c[j];
            g.v = g.z;
            for (var h = e.length - 1; !a.ea && 0 <= h && g.v; h--) a.currentTarget = e[h], d &= Kb(g, e[h], a.type, j, a) && a.oa != n
        }
        if (n in c)
            if (g = c[n], g.v = g.z, b)
                for (h = 0; !a.ea && h < e.length && g.v; h++) a.currentTarget = e[h], d &= Kb(g, e[h], a.type, n, a) && a.oa != n;
            else
                for (e = this; !a.ea && e && g.v; e = e.Fa) a.currentTarget =
                    e, d &= Kb(g, e, a.type, n, a) && a.oa != n;
        a = Boolean(d)
    } else a = j;
    return a
};
o.d = function() {
    T.e.d.call(this);
    Jb(this);
    this.Fa = l
};

function Mb(a, b) {
    this.xa = a || 1;
    this.qa = b || Nb;
    this.Ia = x(this.Tb, this);
    this.Qa = y()
}
A(Mb, T);
Mb.prototype.enabled = n;
var Nb = p.window;
o = Mb.prototype;
o.W = l;
o.Tb = function() {
    if (this.enabled) {
        var a = y() - this.Qa;
        0 < a && a < 0.8 * this.xa ? this.W = this.qa.setTimeout(this.Ia, this.xa - a) : (this.dispatchEvent(Ob), this.enabled && (this.W = this.qa.setTimeout(this.Ia, this.xa), this.Qa = y()))
    }
};
o.start = function() {
    this.enabled = j;
    this.W || (this.W = this.qa.setTimeout(this.Ia, this.xa), this.Qa = y())
};
o.stop = function() {
    this.enabled = n;
    this.W && (this.qa.clearTimeout(this.W), this.W = l)
};
o.d = function() {
    Mb.e.d.call(this);
    this.stop();
    delete this.qa
};
var Ob = "tick";

function Pb(a) {
    v(a) || (a && "function" == typeof a.handleEvent ? a = x(a.handleEvent, a) : f(Error("Invalid listener argument")));
    return Nb.setTimeout(a, 20)
};

function Qb(a, b, c, d, e) {
    if (!E && (!G || !H("525"))) return j;
    if (C && e) return Rb(a);
    if (e && !d || !c && (17 == b || 18 == b) || E && d && b == a) return n;
    switch (a) {
        case 13:
            return !(E && I(9));
        case 27:
            return !G
    }
    return Rb(a)
}

function Rb(a) {
    if (48 <= a && 57 >= a || 96 <= a && 106 >= a || 65 <= a && 90 >= a || G && 0 == a) return j;
    switch (a) {
        case 32:
        case 63:
        case 107:
        case 109:
        case 110:
        case 111:
        case 186:
        case 59:
        case 189:
        case 187:
        case 188:
        case 190:
        case 191:
        case 192:
        case 222:
        case 219:
        case 220:
        case 221:
            return j;
        default:
            return n
    }
};

function Sb(a, b) {
    a && (this.Aa && this.detach(), this.j = a, this.za = R(this.j, "keypress", this, b), this.Pa = R(this.j, "keydown", this.Oa, b, this), this.Aa = R(this.j, "keyup", this.Eb, b, this))
}
A(Sb, T);
o = Sb.prototype;
o.j = l;
o.za = l;
o.Pa = l;
o.Aa = l;
o.M = -1;
o.L = -1;
var Tb = {
        3: 13,
        12: 144,
        63232: 38,
        63233: 40,
        63234: 37,
        63235: 39,
        63236: 112,
        63237: 113,
        63238: 114,
        63239: 115,
        63240: 116,
        63241: 117,
        63242: 118,
        63243: 119,
        63244: 120,
        63245: 121,
        63246: 122,
        63247: 123,
        63248: 44,
        63272: 46,
        63273: 36,
        63275: 35,
        63276: 33,
        63277: 34,
        63289: 144,
        63302: 45
    },
    Ub = {
        Up: 38,
        Down: 40,
        Left: 37,
        Right: 39,
        Enter: 13,
        F1: 112,
        F2: 113,
        F3: 114,
        F4: 115,
        F5: 116,
        F6: 117,
        F7: 118,
        F8: 119,
        F9: 120,
        F10: 121,
        F11: 122,
        F12: 123,
        "U+007F": 46,
        Home: 36,
        End: 35,
        PageUp: 33,
        PageDown: 34,
        Insert: 45
    },
    Vb = {
        61: 187,
        59: 186
    },
    Wb = E || G && H("525");
o = Sb.prototype;
o.Oa = function(a) {
    if (G && (17 == this.M && !a.ctrlKey || 18 == this.M && !a.altKey)) this.L = this.M = -1;
    Wb && !Qb(a.keyCode, this.M, a.shiftKey, a.ctrlKey, a.altKey) ? this.handleEvent(a) : this.L = F && a.keyCode in Vb ? Vb[a.keyCode] : a.keyCode
};
o.Eb = function() {
    this.L = this.M = -1
};
o.handleEvent = function(a) {
    var b = a.s,
        c, d;
    E && "keypress" == a.type ? (c = this.L, d = 13 != c && 27 != c ? b.keyCode : 0) : G && "keypress" == a.type ? (c = this.L, d = 0 <= b.charCode && 63232 > b.charCode && Rb(c) ? b.charCode : 0) : Da ? (c = this.L, d = Rb(c) ? b.keyCode : 0) : (c = b.keyCode || this.L, d = b.charCode || 0, C && 63 == d && !c && (c = 191));
    var e = c,
        g = b.keyIdentifier;
    c ? 63232 <= c && c in Tb ? e = Tb[c] : 25 == c && a.shiftKey && (e = 9) : g && g in Ub && (e = Ub[g]);
    a = e == this.M;
    this.M = e;
    b = new Xb(e, d, a, b);
    try {
        this.dispatchEvent(b)
    } finally {
        b.i()
    }
};
o.b = aa("j");
o.detach = function() {
    this.za && (S(this.za), S(this.Pa), S(this.Aa), this.Aa = this.Pa = this.za = l);
    this.j = l;
    this.L = this.M = -1
};
o.d = function() {
    Sb.e.d.call(this);
    this.detach()
};

function Xb(a, b, c, d) {
    d && this.K(d, i);
    this.type = "key";
    this.keyCode = a;
    this.charCode = b;
    this.repeat = c
}
A(Xb, O);

function Yb(a) {
    this.j = a;
    this.ob = R(this.j, F ? "DOMMouseScroll" : "mousewheel", this)
}
A(Yb, T);
Yb.prototype.handleEvent = function(a) {
    var b = 0,
        c = 0,
        d = 0,
        a = a.s;
    if ("mousewheel" == a.type) {
        c = 1;
        if (E || G && (Ga || H("532.0"))) c = 40;
        d = G && C && 0 != -a.wheelDelta % c ? -a.wheelDelta : -a.wheelDelta / c;
        r(a.wheelDeltaX) ? (b = G && C && 0 != -a.wheelDeltaX % c ? -a.wheelDeltaX : -a.wheelDeltaX / c, c = G && C && 0 != -a.wheelDeltaY % c ? -a.wheelDeltaY : -a.wheelDeltaY / c) : c = d
    } else d = a.detail, 100 < d ? d = 3 : -100 > d && (d = -3), r(a.axis) && a.axis === a.HORIZONTAL_AXIS ? b = d : c = d;
    "number" == typeof this.pb && (b = lb(b, -this.pb, this.pb));
    "number" == typeof this.qb && (c = lb(c, -this.qb,
        this.qb));
    b = new Zb(d, a, b, c);
    try {
        this.dispatchEvent(b)
    } finally {
        b.i()
    }
};
Yb.prototype.d = function() {
    Yb.e.d.call(this);
    S(this.ob);
    delete this.ob
};

function Zb(a, b, c, d) {
    b && this.K(b, i);
    this.type = "mousewheel";
    this.detail = a;
    this.P = c;
    this.Q = d
}
A(Zb, O);

function $b(a) {
    this.hb = a;
    this.Ba = []
}
A($b, sb);
var ac = [];

function U(a, b, c, d, e) {
    t(c) || (ac[0] = c, c = ac);
    for (var g = 0; g < c.length; g++) a.Ba.push(R(b, c[g], d || a, e || n, a.hb || a));
    return a
}

function bc(a, b, c, d, e, g) {
    if (t(c))
        for (var h = 0; h < c.length; h++) bc(a, b, c[h], d, e, g);
    else {
        a: {
            d = d || a;
            g = g || a.hb || a;
            e = !!e;
            if (b = Hb(b, c, e))
                for (c = 0; c < b.length; c++)
                    if (!b[c].U && b[c].aa == d && b[c].capture == e && b[c].wa == g) {
                        b = b[c];
                        break a
                    }
            b = l
        }
        b && (b = b.key, S(b), ra(a.Ba, b))
    }
    return a
}

function cc(a) {
    qa(a.Ba, S);
    a.Ba.length = 0
}
$b.prototype.d = function() {
    $b.e.d.call(this);
    cc(this)
};
$b.prototype.handleEvent = function() {
    f(Error("EventHandler.handleEvent not implemented"))
};

function V() {
    this.g = W;
    this.ka = this.startTime = l
}
A(V, T);
var W = 0;
V.prototype.ca = function() {
    this.q("begin")
};
V.prototype.da = function() {
    this.q("end")
};
V.prototype.q = function(a) {
    this.dispatchEvent(a)
};

function dc() {
    V.call(this);
    this.N = []
}
A(dc, V);
dc.prototype.add = function(a) {
    0 <= pa(this.N, a) || (this.N.push(a), R(a, "finish", this.Ob, n, this))
};
dc.prototype.d = function() {
    qa(this.N, function(a) {
        a.i()
    });
    this.N.length = 0;
    dc.e.d.call(this)
};

function ec() {
    dc.call(this);
    this.Ma = 0
}
A(ec, dc);
ec.prototype.play = function(a) {
    if (0 == this.N.length) return n;
    if (a || this.g == W) this.Ma = 0, this.ca();
    else if (1 == this.g) return n;
    this.q("play"); - 1 == this.g && this.q("resume");
    var b = -1 == this.g && !a;
    this.startTime = y();
    this.ka = l;
    this.g = 1;
    qa(this.N, function(c) {
        (!b || -1 == c.g) && c.play(a)
    });
    return j
};
ec.prototype.stop = function(a) {
    qa(this.N, function(b) {
        b.g == W || b.stop(a)
    });
    this.g = W;
    this.ka = y();
    this.q("stop");
    this.da()
};
ec.prototype.Ob = function() {
    this.Ma++;
    this.Ma == this.N.length && (this.ka = y(), this.g = W, this.q("finish"), this.da())
};

function fc(a, b, c) {
    this.target = a;
    this.handle = b || a;
    this.nb = c || new mb(NaN, NaN, NaN, NaN);
    this.r = L(a);
    this.C = new $b(this);
    R(this.handle, ["touchstart", "mousedown"], this.ub, n, this)
}
A(fc, T);
var gc = E || F && H("1.9.3");
o = fc.prototype;
o.clientX = 0;
o.clientY = 0;
o.screenX = 0;
o.screenY = 0;
o.vb = 0;
o.wb = 0;
o.P = 0;
o.Q = 0;
o.Ka = j;
o.I = n;
o.ib = 0;
o.Kb = n;
o.S = aa("C");
o.d = function() {
    fc.e.d.call(this);
    Gb(this.handle, ["touchstart", "mousedown"], this.ub, n, this);
    this.C.i();
    delete this.target;
    delete this.handle;
    delete this.C
};
o.ub = function(a) {
    var b = "mousedown" == a.type;
    if (this.Ka && !this.I && (!b || (ub ? 0 == a.s.button : "click" == a.type || a.s.button & zb[0]) && (!G || !C || !a.ctrlKey))) {
        hc(a);
        if (0 == this.ib)
            if (ic(this, a), this.I) a.preventDefault();
            else return;
        else a.preventDefault();
        var b = this.r,
            c = b.documentElement,
            d = !gc;
        U(this.C, b, ["touchmove", "mousemove"], this.Hb, d);
        U(this.C, b, ["touchend", "mouseup"], this.ua, d);
        gc ? (c.setCapture(n), U(this.C, c, "losecapture", this.ua)) : U(this.C, b ? b.parentWindow || b.defaultView : window, "blur", this.ua);
        E && this.Kb &&
            U(this.C, b, "dragstart", xb);
        this.Rb && U(this.C, this.Rb, "scroll", this.Pb, d);
        this.clientX = this.vb = a.clientX;
        this.clientY = this.wb = a.clientY;
        this.screenX = a.screenX;
        this.screenY = a.screenY;
        this.P = this.target.offsetLeft;
        this.Q = this.target.offsetTop;
        this.Sa = kb(J(this.r));
        y()
    } else this.dispatchEvent("earlycancel")
};

function ic(a, b) {
    a.dispatchEvent(new jc("start", a, b.clientX, b.clientY)) !== n && (a.I = j)
}
o.ua = function(a) {
    cc(this.C);
    gc && this.r.releaseCapture();
    var b = kc(this, this.P),
        c = lc(this, this.Q);
    this.I ? (hc(a), this.I = n, this.dispatchEvent(new jc("end", this, a.clientX, a.clientY, 0, b, c))) : this.dispatchEvent("earlycancel");
    ("touchend" == a.type || "touchcancel" == a.type) && a.preventDefault()
};

function hc(a) {
    var b = a.type;
    "touchstart" == b || "touchmove" == b ? a.K(a.s.targetTouches[0], a.currentTarget) : ("touchend" == b || "touchcancel" == b) && a.K(a.s.changedTouches[0], a.currentTarget)
}
o.Hb = function(a) {
    if (this.Ka) {
        hc(a);
        var b = a.clientX - this.clientX,
            c = a.clientY - this.clientY;
        this.clientX = a.clientX;
        this.clientY = a.clientY;
        this.screenX = a.screenX;
        this.screenY = a.screenY;
        if (!this.I) {
            var d = this.vb - this.clientX,
                e = this.wb - this.clientY;
            if (d * d + e * e > this.ib && (ic(this, a), !this.I)) {
                this.ua(a);
                return
            }
        }
        c = mc(this, b, c);
        b = c.x;
        c = c.y;
        this.I && this.dispatchEvent(new jc("beforedrag", this, a.clientX, a.clientY, 0, b, c)) !== n && (nc(this, a, b, c), a.preventDefault())
    }
};

function mc(a, b, c) {
    var d = kb(J(a.r)),
        b = b + (d.x - a.Sa.x),
        c = c + (d.y - a.Sa.y);
    a.Sa = d;
    a.P += b;
    a.Q += c;
    b = kc(a, a.P);
    a = lc(a, a.Q);
    return new Wa(b, a)
}
o.Pb = function(a) {
    var b = mc(this, 0, 0);
    a.clientX = this.clientX;
    a.clientY = this.clientY;
    nc(this, a, b.x, b.y)
};

function nc(a, b, c, d) {
    a.Ja(c, d);
    a.dispatchEvent(new jc("drag", a, b.clientX, b.clientY, 0, c, d))
}

function kc(a, b) {
    var c = a.nb,
        d = !isNaN(c.left) ? c.left : l,
        c = !isNaN(c.width) ? c.width : 0;
    return Math.min(d != l ? d + c : Infinity, Math.max(d != l ? d : -Infinity, b))
}

function lc(a, b) {
    var c = a.nb,
        d = !isNaN(c.top) ? c.top : l,
        c = !isNaN(c.height) ? c.height : 0;
    return Math.min(d != l ? d + c : Infinity, Math.max(d != l ? d : -Infinity, b))
}
o.Ja = function(a, b) {
    this.target.style.left = a + "px";
    this.target.style.top = b + "px"
};

function jc(a, b, c, d, e, g, h) {
    N.call(this, a);
    this.clientX = c;
    this.clientY = d;
    this.left = r(g) ? g : b.P;
    this.top = r(h) ? h : b.Q;
    this.ab = b
}
A(jc, N);
var Za = {},
    oc = l;

function pc(a) {
    a = w(a);
    delete Za[a];
    Ya() && oc && (Nb.clearTimeout(oc), oc = l)
}

function qc() {
    oc || (oc = Pb(function() {
        oc = l;
        rc()
    }))
}

function rc() {
    var a = y();
    Xa(Za, function(b) {
        sc(b, a)
    });
    Ya() || qc()
};

function tc(a, b, c, d) {
    V.call(this);
    (!t(a) || !t(b)) && f(Error("Start and end parameters must be arrays"));
    a.length != b.length && f(Error("Start and end points must be the same length"));
    this.ga = a;
    this.Cb = b;
    this.duration = c;
    this.Xa = d;
    this.coords = []
}
A(tc, V);
o = tc.prototype;
o.u = 0;
o.play = function(a) {
    if (a || this.g == W) this.u = 0, this.coords = this.ga;
    else if (1 == this.g) return n;
    pc(this);
    this.startTime = a = y(); - 1 == this.g && (this.startTime -= this.duration * this.u);
    this.ka = this.startTime + this.duration;
    this.u || this.ca();
    this.q("play"); - 1 == this.g && this.q("resume");
    this.g = 1;
    var b = w(this);
    b in Za || (Za[b] = this);
    qc();
    sc(this, a);
    return j
};
o.stop = function(a) {
    pc(this);
    this.g = W;
    a && (this.u = 1);
    uc(this, this.u);
    this.q("stop");
    this.da()
};
o.d = function() {
    this.g == W || this.stop(n);
    this.q("destroy");
    tc.e.d.call(this)
};

function sc(a, b) {
    a.u = (b - a.startTime) / (a.ka - a.startTime);
    1 <= a.u && (a.u = 1);
    uc(a, a.u);
    1 == a.u ? (a.g = W, pc(a), a.q("finish"), a.da()) : 1 == a.g && a.Ra()
}

function uc(a, b) {
    v(a.Xa) && (b = a.Xa(b));
    a.coords = Array(a.ga.length);
    for (var c = 0; c < a.ga.length; c++) a.coords[c] = (a.Cb[c] - a.ga[c]) * b + a.ga[c]
}
o.Ra = function() {
    this.q("animate")
};
o.q = function(a) {
    this.dispatchEvent(new vc(a, this))
};

function vc(a, b) {
    N.call(this, a);
    this.coords = b.coords;
    this.x = b.coords[0];
    this.y = b.coords[1];
    this.duration = b.duration;
    this.u = b.u;
    this.state = b.g
}
A(vc, N);

function X(a, b, c, d, e) {
    tc.call(this, b, c, d, e);
    this.element = a
}
A(X, tc);
X.prototype.ha = ba;
X.prototype.Ra = function() {
    this.ha();
    X.e.Ra.call(this)
};
X.prototype.da = function() {
    this.ha();
    X.e.da.call(this)
};
X.prototype.ca = function() {
    this.ha();
    X.e.ca.call(this)
};

function wc(a, b, c, d, e) {
    (2 != b.length || 2 != c.length) && f(Error("Start and end points must be 2D"));
    X.apply(this, arguments)
}
A(wc, X);
wc.prototype.ha = function() {
    this.element.style.left = Math.round(this.coords[0]) + "px";
    this.element.style.top = Math.round(this.coords[1]) + "px"
};

function xc(a, b, c, d) {
    wc.call(this, a, [a.offsetLeft, a.offsetTop], b, c, d)
}
A(xc, wc);
xc.prototype.ca = function() {
    this.ga = [this.element.offsetLeft, this.element.offsetTop];
    xc.e.ca.call(this)
};

function yc(a, b, c, d, e) {
    X.call(this, a, [b], [c], d, e)
}
A(yc, X);
yc.prototype.ha = function() {
    this.element.style.width = Math.round(this.coords[0]) + "px"
};

function zc(a, b, c, d, e) {
    X.call(this, a, [b], [c], d, e)
}
A(zc, X);
zc.prototype.ha = function() {
    this.element.style.height = Math.round(this.coords[0]) + "px"
};

function Ac() {}(function(a) {
    a.bb = function() {
        return a.Lb || (a.Lb = new a)
    }
})(Ac);
Ac.prototype.Nb = 0;
Ac.bb();

function Bc(a) {
    this.Y = a || J()
}
A(Bc, T);
o = Bc.prototype;
o.Jb = Ac.bb();
o.jb = l;
o.$ = n;
o.j = l;
o.Ga = l;
o.ra = l;
o.ia = l;
o.zb = n;
o.b = aa("j");
o.S = function() {
    return this.Z || (this.Z = new $b(this))
};
o.Ta = function(a) {
    this.Ga && this.Ga != a && f(Error("Method not supported"));
    Bc.e.Ta.call(this, a)
};
o.Na = aa("Y");
o.ja = function() {
    this.j = this.Y.createElement("div")
};

function Cc(a, b) {
    a.$ && f(Error("Component already rendered"));
    if (b) {
        a.zb = j;
        if (!a.Y || a.Y.r != L(b)) a.Y = J(b);
        a.ta(b);
        a.va()
    } else f(Error("Invalid element to decorate"))
}
o.ta = function(a) {
    this.j = a
};
o.va = function() {
    this.$ = j;
    Dc(this, function(a) {
        !a.$ && a.b() && a.va()
    })
};
o.la = function() {
    Dc(this, function(a) {
        a.$ && a.la()
    });
    this.Z && cc(this.Z);
    this.$ = n
};
o.d = function() {
    Bc.e.d.call(this);
    this.$ && this.la();
    this.Z && (this.Z.i(), delete this.Z);
    Dc(this, function(a) {
        a.i()
    });
    !this.zb && this.j && ib(this.j);
    this.Ga = this.j = this.ia = this.ra = l
};

function Dc(a, b) {
    a.ra && qa(a.ra, b, i)
}
o.removeChild = function(a, b) {
    if (a) {
        var c = u(a) ? a : a.jb || (a.jb = ":" + (a.Jb.Nb++).toString(36)),
            a = this.ia && c ? (c in this.ia ? this.ia[c] : i) || l : l;
        if (c && a) {
            var d = this.ia;
            c in d && delete d[c];
            ra(this.ra, a);
            b && (a.la(), a.j && ib(a.j));
            c = a;
            c == l && f(Error("Unable to set parent component"));
            c.Ga = l;
            Bc.e.Ta.call(c, l)
        }
    }
    a || f(Error("Child is not in parent component"));
    return a
};

function Ec() {}
A(Ec, T);
o = Ec.prototype;
o.X = 0;
o.A = 0;
o.t = 100;
o.n = 0;
o.O = 1;
o.o = n;
o.T = n;
o.V = function(a) {
    a = Y(this, a);
    this.X != a && (this.X = a + this.n > this.t ? this.t - this.n : a < this.A ? this.A : a, !this.o && !this.T && this.dispatchEvent("change"))
};
o.h = function() {
    return Y(this, this.X)
};
o.fa = function(a) {
    a = Y(this, a);
    this.n != a && (this.n = 0 > a ? 0 : this.X + a > this.t ? this.t - this.X : a, !this.o && !this.T && this.dispatchEvent("change"))
};
o.D = function() {
    return this.O == l ? this.n : Math.round(this.n / this.O) * this.O
};
o.Ha = function(a) {
    if (this.A != a) {
        var b = this.o;
        this.o = j;
        this.A = a;
        a + this.n > this.t && (this.n = this.t - this.A);
        a > this.X && this.V(a);
        a > this.t && (this.n = 0, this.pa(a), this.V(a));
        this.o = b;
        !this.o && !this.T && this.dispatchEvent("change")
    }
};
o.l = function() {
    return Y(this, this.A)
};
o.pa = function(a) {
    a = Y(this, a);
    if (this.t != a) {
        var b = this.o;
        this.o = j;
        this.t = a;
        a < this.X + this.n && this.V(a - this.n);
        a < this.A && (this.n = 0, this.Ha(a), this.V(this.t));
        a < this.A + this.n && (this.n = this.t - this.A);
        this.o = b;
        !this.o && !this.T && this.dispatchEvent("change")
    }
};
o.k = function() {
    return Y(this, this.t)
};
o.Ua = function(a) {
    this.O != a && (this.O = a, a = this.o, this.o = j, this.pa(this.k()), this.fa(this.D()), this.V(this.h()), this.o = a, !this.o && !this.T && this.dispatchEvent("change"))
};

function Y(a, b) {
    return a.O == l ? b : a.A + Math.round((b - a.A) / a.O) * a.O
};

function Z(a) {
    this.Y = a || J();
    this.a = new Ec;
    R(this.a, "change", this.Ib, n, this)
}
A(Z, Bc);
o = Z.prototype;
o.p = "horizontal";
o.ya = n;
o.rb = n;
o.H = 10;
o.na = 0;
o.Mb = j;
o.Ka = j;
o.ja = function() {
    Z.e.ja.call(this);
    this.ta(this.Na().ja("div", Fc(this.p)))
};
o.ta = function(a) {
    Z.e.ta.call(this, a);
    Ua(a, Fc(this.p));
    var a = this.b(),
        b;
    var c, d, e;
    b = a || document;
    if (b.querySelectorAll && b.querySelector && (!G || "CSS1Compat" == document.compatMode || H("528"))) b = b.querySelectorAll(".goog-slider-thumb");
    else if (b.getElementsByClassName) {
        var g = b.getElementsByClassName("goog-slider-thumb");
        b = g
    } else {
        g = b.getElementsByTagName("*");
        e = {};
        for (c = d = 0; b = g[c]; c++) {
            var h = b.className;
            "function" == typeof h.split && 0 <= pa(h.split(/\s+/), "goog-slider-thumb") && (e[d++] = b)
        }
        e.length = d;
        b = e
    }
    b = b[0];
    b || (b = this.Na().ja("div", "goog-slider-thumb"), b.setAttribute("role", "button"), b.Qb = "button", a.appendChild(b));
    this.c = this.m = b;
    a = this.b();
    a.setAttribute("role", "slider");
    a.Qb = "slider";
    Gc(this)
};
o.va = function() {
    Z.e.va.call(this);
    this.G = new fc(this.c);
    this.R = new fc(this.m);
    this.G.Ja = this.R.Ja = ba;
    this.ma = new Sb(this.b());
    U(U(U(U(U(U(this.S(), this.G, "beforedrag", this.eb), this.R, "beforedrag", this.eb), this.G, ["start", "end"], this.fb), this.R, ["start", "end"], this.fb), this.ma, "key", this.Oa), this.b(), "mousedown", this.Fb);
    this.Mb && (this.ba || (this.ba = new Yb(this.b())), U(this.S(), this.ba, "mousewheel", this.Gb));
    this.b().tabIndex = 0;
    Hc(this)
};
o.la = function() {
    Z.e.la.call(this);
    tb(this.G, this.R, this.ma, this.ba)
};
o.eb = function(a) {
    var b = a.ab == this.G ? this.c : this.m,
        c;
    "vertical" == this.p ? (c = this.b().clientHeight - b.offsetHeight, c = (c - a.top) / c * (this.k() - this.l()) + this.l()) : c = a.left / (this.b().clientWidth - b.offsetWidth) * (this.k() - this.l()) + this.l();
    c = a.ab == this.G ? Math.min(Math.max(c, this.l()), this.h() + this.D()) : Math.min(Math.max(c, this.h()), this.k());
    Ic(this, b, c)
};
o.fb = function(a) {
    var b = "start" == a.type,
        c = this.b();
    b ? Ua(c, "goog-slider-dragging") : Va(c, "goog-slider-dragging");
    a = a.target.handle;
    b ? Ua(a, "goog-slider-thumb-dragging") : Va(a, "goog-slider-thumb-dragging")
};
o.Oa = function(a) {
    var b = j;
    switch (a.keyCode) {
        case 36:
            Jc(this, this.l());
            break;
        case 35:
            Jc(this, this.k());
            break;
        case 33:
            Kc(this, this.H);
            break;
        case 34:
            Kc(this, -this.H);
            break;
        case 37:
        case 40:
            Kc(this, a.shiftKey ? -this.H : -this.Wa);
            break;
        case 39:
        case 38:
            Kc(this, a.shiftKey ? this.H : this.Wa);
            break;
        default:
            b = n
    }
    b && a.preventDefault()
};
o.Fb = function(a) {
    this.b().focus && this.b().focus();
    var b = a.target;
    !jb(this.c, b) && !jb(this.m, b) && (this.rb ? Jc(this, Lc(this, a)) : (this.Va(a), this.w = Mc(this, Lc(this, a)), this.kb = "vertical" == this.p ? this.Ca < this.w.offsetTop : this.Ca > this.w.offsetLeft + this.w.offsetWidth, a = L(this.b()), U(U(this.S(), a, "mouseup", this.xb, j), this.b(), "mousemove", this.Va), this.J || (this.J = new Mb(200), U(this.S(), this.J, Ob, this.gb)), this.gb(), this.J.start()))
};
o.Gb = function(a) {
    Kc(this, (0 < a.detail ? -1 : 1) * this.Wa);
    a.preventDefault()
};
o.gb = function() {
    var a;
    if ("vertical" == this.p) {
        var b = this.Ca,
            c = this.w.offsetTop;
        this.kb ? b < c && (a = $(this, this.w) + this.H) : b > c + this.w.offsetHeight && (a = $(this, this.w) - this.H)
    } else b = this.Ca, c = this.w.offsetLeft, this.kb ? b > c + this.w.offsetWidth && (a = $(this, this.w) + this.H) : b < c && (a = $(this, this.w) - this.H);
    r(a) && Ic(this, this.w, a)
};
o.xb = function() {
    this.J && this.J.stop();
    var a = L(this.b());
    bc(bc(this.S(), a, "mouseup", this.xb, j), this.b(), "mousemove", this.Va)
};

function Nc(a, b) {
    var c, d = a.b();
    c = qb(b);
    d = qb(d);
    c = new Wa(c.x - d.x, c.y - d.y);
    return "vertical" == a.p ? c.y : c.x
}
o.Va = function(a) {
    this.Ca = Nc(this, a)
};

function Lc(a, b) {
    var c = a.l(),
        d = a.k();
    if ("vertical" == a.p) {
        var e = a.c.offsetHeight,
            g = a.b().clientHeight - e,
            e = Nc(a, b) - e / 2;
        return (d - c) * (g - e) / g + c
    }
    e = a.c.offsetWidth;
    g = a.b().clientWidth - e;
    e = Nc(a, b) - e / 2;
    return (d - c) * e / g + c
}

function $(a, b) {
    if (b == a.c) return a.a.h();
    if (b == a.m) return a.a.h() + a.a.D();
    f(Error("Illegal thumb element. Neither minThumb nor maxThumb"))
}

function Kc(a, b) {
    var c = $(a, a.c) + b,
        d = $(a, a.m) + b,
        c = lb(c, a.l(), a.k() - a.na),
        d = lb(d, a.l() + a.na, a.k());
    Oc(a, c, d - c)
}

function Ic(a, b, c) {
    var d = l;
    b == a.m && c <= a.a.k() && c >= a.a.h() + a.na && (d = c - a.a.h());
    var e = d || a.a.D();
    b == a.c && c >= a.l() && c <= a.a.h() + e - a.na && (b = e - (c - a.a.h()), Y(a.a, c) + Y(a.a, b) == Y(a.a, c + b) && (Oc(a, c, b), d = l));
    d != l && a.a.fa(d)
}

function Oc(a, b, c) {
    a.l() <= b && b <= a.k() - c && a.na <= c && c <= a.k() - b && !(b == a.h() && c == a.D()) && (a.a.T = j, a.a.fa(0), a.a.V(b), a.a.fa(c), a.a.T = n, Hc(a), a.dispatchEvent("change"))
}
o.l = function() {
    return this.a.l()
};
o.Ha = function(a) {
    this.a.Ha(a)
};
o.k = function() {
    return this.a.k()
};
o.pa = function(a) {
    this.a.pa(a)
};

function Mc(a, b) {
    return b <= a.a.h() + a.a.D() / 2 ? a.c : a.m
}
o.Ib = function() {
    Hc(this);
    Gc(this);
    this.dispatchEvent("change")
};

function Hc(a) {
    if (a.c && !a.ya) {
        var b = Pc(a, $(a, a.c)),
            c = Pc(a, $(a, a.m));
        "vertical" == a.p ? (a.c.style.top = b.y + "px", a.m.style.top = c.y + "px", a.f && (b = Qc(c.y, b.y, a.c.offsetHeight), a.f.style.top = b.Ea + "px", a.f.style.height = b.size + "px")) : (a.c.style.left = b.x + "px", a.m.style.left = c.x + "px", a.f && (b = Qc(b.x, c.x, a.c.offsetWidth), a.f.style.left = b.Ea + "px", a.f.style.width = b.size + "px"))
    }
}

function Qc(a, b, c) {
    var d = Math.ceil(c / 2);
    return {
        Ea: a + d,
        size: Math.max(b - a + c - 2 * d, 0)
    }
}

function Pc(a, b) {
    var c = new Wa;
    if (a.c) {
        var d = a.l(),
            e = a.k(),
            e = b == d && d == e ? 0 : (b - d) / (e - d);
        "vertical" == a.p ? (d = a.b().clientHeight - a.c.offsetHeight, e = Math.round(e * d), c.y = d - e) : (d = Math.round(e * (a.b().clientWidth - a.c.offsetWidth)), c.x = d)
    }
    return c
}

function Jc(a, b) {
    b = Math.min(a.k(), Math.max(b, a.l()));
    a.ya && a.sa.stop(j);
    var c = new ec,
        d = Mc(a, b),
        e = Pc(a, b);
    c.add(new xc(d, "vertical" == a.p ? [d.offsetLeft, e.y] : [e.x, d.offsetTop], 100));
    if (a.f) {
        var g = Pc(a, a.a.h()),
            h = Pc(a, a.a.h() + a.a.D());
        d == a.c ? g = e : h = e;
        "vertical" == a.p ? (e = Qc(h.y, g.y, a.c.offsetHeight), c.add(new xc(a.f, [a.f.offsetLeft, e.Ea], 100)), c.add(new zc(a.f, a.f.offsetHeight, e.size, 100))) : (e = Qc(g.x, h.x, a.c.offsetWidth), c.add(new xc(a.f, [e.Ea, a.f.offsetTop], 100)), c.add(new yc(a.f, a.f.offsetWidth, e.size,
            100)))
    }
    a.sa = c;
    U(a.S(), c, "end", a.Bb);
    a.ya = j;
    Ic(a, d, b);
    c.play(n)
}
o.Bb = function() {
    this.ya = n
};

function Rc(a) {
    if ("horizontal" != a.p) {
        var b = Fc(a.p),
            c = Fc("horizontal");
        a.p = "horizontal";
        if (a.b()) {
            for (var d = a.b(), e = Ta(d), g = n, h = 0; h < e.length; h++) e[h] == b && (ua(e, h--, 1), g = j);
            g && (e.push(c), d.className = e.join(" "));
            a.c.style.left = a.c.style.top = "";
            a.m.style.left = a.m.style.top = "";
            a.f && (a.f.style.left = a.f.style.top = "", a.f.style.width = a.f.style.height = "");
            Hc(a)
        }
    }
}
o.d = function() {
    Z.e.d.call(this);
    this.J && this.J.i();
    delete this.J;
    this.sa && this.sa.i();
    delete this.sa;
    delete this.c;
    delete this.m;
    this.f && delete this.f;
    this.a.i();
    delete this.a;
    this.ma && (this.ma.i(), delete this.ma);
    this.ba && (this.ba.i(), delete this.ba);
    this.G && (this.G.i(), delete this.G);
    this.R && (this.R.i(), delete this.R)
};
o.Wa = 1;
o.Ua = function(a) {
    this.a.Ua(a)
};
o.h = function() {
    return this.a.h()
};
o.V = function(a) {
    Ic(this, this.c, a)
};
o.D = function() {
    return this.a.D()
};
o.fa = function(a) {
    Ic(this, this.m, this.a.h() + a)
};

function Gc(a) {
    var b = a.b();
    if (b) {
        var c = a.l();
        b.setAttribute("aria-valuemin", c);
        c = a.k();
        b.setAttribute("aria-valuemax", c);
        a = a.h();
        b.setAttribute("aria-valuenow", a)
    }
};

function Sc(a) {
    Z.call(this, a);
    this.a.fa(0)
}
A(Sc, Z);

function Fc(a) {
    return "vertical" == a ? "goog-slider-vertical" : "goog-slider-horizontal"
};
z("klokantech.OpacityControl", function(a, b) {
    this.map = a;
    this.mb = b;
    v(this.mb.setOpacity) || alert("Invalid layer");
    var c = eb("div", {
        style: "margin:5px;overflow:hidden;background:url(https://maptilercdn.s3.amazonaws.com/opacity-slider3d7.png) no-repeat;width:71px;height:21px;cursor:pointer"
    });
    this.B = new Sc;
    Rc(this.B);
    Cc(this.B, c);
    this.B.c.setAttribute("style", "padding:0;margin:0;overflow:hidden;background:url(https://maptilercdn.s3.amazonaws.com/opacity-slider3d7.png) no-repeat -71px 0;width:10px;height:21px;position:relative");
    this.B.Ha(0);
    this.B.pa(1);
    this.B.Ua(l);
    this.B.rb = j;
    this.B.addEventListener("change", x(function() {
        this.mb.setOpacity(this.B.h(), j)
    }, this));
    this.B.c.style.left = "61px";
    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(this.B.b())
});

return klokantech;
});
