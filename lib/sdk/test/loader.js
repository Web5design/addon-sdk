/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader, resolveURI, Require,
        unload, override, descriptor  } = require('../loader/cuddlefish');
const { ensure } = require('../system/unload');
const addonWindow = require('../addon/window');
const { PlainTextConsole } = require("sdk/console/plain-text");

function CustomLoader(module, globals, packaging, overrides={}) {
  let options = packaging || require("@loader/options");
  options = override(options, {
    id: overrides.id || options.id,
    globals: override(require('../system/globals'), globals || {}),
    modules: override(options.modules || {}, {
      'sdk/addon/window': addonWindow
     })
  });

  let loader = Loader(options);
  let wrapper = Object.create(loader, descriptor({
    require: Require(loader, module),
    sandbox: function(id) {
      let requirement = loader.resolve(id, module.id);
      let uri = resolveURI(requirement, loader.mapping);
      return loader.sandboxes[uri];
    },
    unload: function(reason) {
      unload(loader, reason);
    }
  }));
  ensure(wrapper);
  return wrapper;
};
exports.Loader = CustomLoader;

// Creates a custom loader instance whose console module is hooked in order
// to avoid printing messages to the console, and instead, expose them in the
// returned `messages` array attribute
exports.LoaderWithHookedConsole = function (module, callback) {
  let messages = [];
  function hook(msg) {
    messages.push({type: this, msg: msg});
    if (callback)
      callback(this, msg);
  }
  return {
    loader: CustomLoader(module, {
      console: {
        log: hook.bind("log"),
        info: hook.bind("info"),
        warn: hook.bind("warn"),
        error: hook.bind("error"),
        debug: hook.bind("debug"),
        exception: hook.bind("exception"),
        __exposedProps__: {
          log: "rw", info: "rw", warn: "rw", error: "rw", debug: "rw",
          exception: "rw"
        }
      }
    }),
    messages: messages
  };
}

// Same than LoaderWithHookedConsole with lower level, instead we get what is
// actually printed to the command line console
exports.LoaderWithHookedConsole2 = function (module, callback) {
  let messages = [];
  return {
    loader: CustomLoader(module, {
      console: new PlainTextConsole(function (msg) {
        messages.push(msg);
        if (callback)
          callback(msg);
      })
    }),
    messages: messages
  };
}
