// Provider
// 1.register components(directives,services, controllers)
// 2.resolve components' dependencies
// 3.initialize components 

// get(name,locals)
// invoke(fn,locals)
// directive(name,fn)
// controller(name,fn)
// service(name,fn)
// annotate(fn)

var Utils = {
    clone :function(source) {
        if (typeof source != Object) return source;
        var target = {}
        Object.assign(target,source)
        return target
    },
    equals: function (a, b) {
        if(typeof a != Object && typeof b != Object) {
            return a == b
        }
        // Create arrays of property names
        var aProps = Object.getOwnPropertyNames(a);
        var bProps = Object.getOwnPropertyNames(b);
    
        // If number of properties is different,
        // objects are not equivalent
        if (aProps.length != bProps.length) {
            return false;
        }
    
        for (var i = 0; i < aProps.length; i++) {
            var propName = aProps[i];
    
            // If values of same property are not equal,
            // objects are not equivalent
            if (a[propName] !== b[propName]) {
                return false;
            }
        }
    
        // If we made it this far, objects
        // are considered equivalent
        return true;
    }
    
}

var Provider = {
    _providers: {},
    directive: function(name,fn) {
        this._register(name+Provider.DIRECTIVES_SUFFIX,fn);
    },
    controller: function(name,fn) {
        this._register(name+Provider.CONTROLLER_SUFFIX,function(){
            return fn;
        })
    },
    service: function(name,fn) {
        this._register(name,fn);
    },
    _register: function(name,factory){
        this._providers[name] = factory;
    },
    get: function(name,locals) {
        if (this._cache[name]) {
            return this._cache[name];
        }
        var provider = this._providers[name];
        if (!provider || typeof provider !== 'function') {
            return null;
        }
        return (this._cache[name] = this.invoke(provider,locals)); 
    },
    annotate: function(fn) {
        var res = fn.toString()
            .replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,'')
            .match(/\((.*?)\)/);
        if (res && res[1]) {
            return res[1].split(',').map(function(d){
                return d.trim();
            })
        }
        return []
    },/*function($scope,$http){} = > ['$scope','$http'] */
    invoke: function(fn,locals) {
        locals = locals || {};
        var deps = this.annotate(fn).map(function(s){
            return locals[s] || this.get(s,locals);
        },this);
        return fn.apply(null,deps)
    },
    _cache: {$rootScope: new Scope()}

};
Provider.DIRECTIVES_SUFFIX = 'Directive';
Provider.CONTROLLER_SUFFIX = 'Controller';


// DOMCompiler
// 1.traverse the DOM Tree 
// 2.find registered directives, used as attributes
// 3.invoke the logic associated with them 
// 4.manages the scope 

// bootstrap()
// compile(el,scope)

var DOMCompiler = {
    bootstrap: function() {
        this.compile(document.children[0],
            Provider.get('$rootScope'));
    },
    compile: function(el,scope) {
        var dirs = this._getElDirectives(el);
        var dir;
        var scopeCreated;
        dirs.forEach(function(d) {
            dir = Provider.get(d.name + Provider.DIRECTIVES_SUFFIX);
            if (dir.scope && !scopeCreated) {
                scope = scope.$new();
                scopeCreated = true;
            }
            dir.link(el,scope,d.value);
        });
        Array.prototype.slice.call(el.children).forEach(function(e){
            this.compile(e,scope);
        },this);
    },
    _getElDirectives: function(el){
        var attrs = el.attributes;
        var result = [];
        for (var i = 0; i < attrs.length; i += 1) {
            if (Provider.get(attrs[i].name + Provider.DIRECTIVES_SUFFIX)) {
                result.push({
                    name: attrs[i].name,
                    value: attrs[i].value
                })
            }
        }
        return result;
    }
}


function Scope(parent,id) {
    this.$$watchers = [];
    this.$$children = [];
    this.$parent = parent;
    this.$id = id || 0;
}
Scope.counter = 0;
Scope.prototype.$watch = function(exp,fn) {
    this.$$watchers.push({
        exp:exp,
        fn:fn,
        last:Utils.clone(this.$eval(exp))
    })
}
Scope.prototype.$new = function () {
    Scope.counter += 1;
    var obj = new Scope(this,Scope.counter);
    this.$$children.push(obj);
    return obj;
}

Scope.prototype.$destroy = function() {
    var pc = this.$parent.$$children;
    pc.splice(pc.indexof(this),1);
}
Scope.prototype.$digest = function () {
    var dirty, watcher, current,i;
    do {
        dirty = false;
        for (i=0;i<this.$$watchers.length;i+=1){
            watcher = this.$$watchers[i];
            current = this.$eval(watcher.exp);
            if (!Utils.equals(watcher.last,current)) {
                watcher.last = Utils.clone(current);
                dirty = true;
                watcher.fn(current);
            }
        }
    }while (dirty);
    for(i=0; i<this.$$children.length;i+=1) {
        this.$$children[i].$digest();
    }
}

Scope.prototype.$eval = function (exp) {
    var val;
    if (typeof exp === 'function') {
      val = exp.call(this);
    } else {
      try {
        with (this) {
          val = eval(exp);
        }
      } catch (e) {
        val = undefined;
      }
    }
    return val;
  };
  /*
  var s=new Scope()
  s.i=1
  s.j=3
  s.foo=function(){
      return this.i + this.j
  }
  s.$eval('i')  => 1
  s.$eval('j)   => 3
  s.$eval(s.foo)  => 4
  */


//   ngl-bind
//   ngl-model 
//   ngl-controller 
//   ngl-click 
//DOMCompiler 1,create scope 2.link
Provider.directive('ngl-bind',function(){
    return {
        scope: false,
        link: function(el,scope,exp) {
            el.innerHTML = scope.$eval(exp);
            scope.$watch(exp,function(val) {
                el.innerHTML = val;

            })
        }
    }
})

Provider.directive('ngl-model',function(){
    return {
        link: function (el,scope,exp) {
            el.onkeyup = function() {
                scope[exp] = el.value;
                scope.$digest();
            }
        }
    }
})

Provider.directive('ngl-controller',function() {
    return {
        scope:true,
        link: function(el,scope,exp) {
            var ctrl = Provider.get(exp+Provider.CONTROLLER_SUFFIX);
            Provider.invoke(ctrl,{$scope: scope})
        }
    }
})

Provider.directive('ngl-click',function() {
    return {
        scope: false,
        link: function(el,scope,exp) {
            el.onclick = function() {
                scope.$eval(exp);
                scope.$digest();
            }
        }
    }
})

/* 
1.how DOMCompiler works 
遍历DOM树，查找directive，创建scope，做link
scope是树状的
2.data binding
将element，directive的value，scope做link，也就是做到了当前scope里对应的value值有变化就
更新DOM element

*/