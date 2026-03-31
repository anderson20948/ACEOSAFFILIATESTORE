function isAsyncFunction(fn) {
  return typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';
}

function catchAsync(fn) {
  if (!isAsyncFunction(fn)) {
    return fn;
  }

  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function wrapHandler(handler) {
  if (Array.isArray(handler)) {
    return handler.map(wrapHandler);
  }
  return isAsyncFunction(handler) ? catchAsync(handler) : handler;
}

function wrapRouter(router) {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all', 'use'];

  methods.forEach((method) => {
    const original = router[method];
    router[method] = function (...handlers) {
      const wrappedHandlers = handlers.map(wrapHandler);
      return original.apply(this, wrappedHandlers);
    };
  });

  return router;
}

module.exports = {
  catchAsync,
  wrapRouter,
};
