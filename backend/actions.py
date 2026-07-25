def dispatch(engine, state, request):
    return engine.apply(state, request.model_dump())
