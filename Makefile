default:
	web-ext lint
	web-ext run
beta: check-ffbeta
	web-ext lint
	web-ext run --firefox=$(FFBETALOC)/firefox/firefox \
	  --pref extensions.experiments.enabled=true
dev: check-ffdev
	web-ext lint
	web-ext run --firefox=$(FFDEVLOC)/firefox/firefox \
	  --pref extensions.experiments.enabled=true
nightly: check-ffnightly
	web-ext lint
	web-ext run --firefox=$(FFNIGHTLYLOC)/firefox/firefox \
	  --pref extensions.experiments.enabled=true

check-ffbeta:
ifndef FFBETALOC
	$(error FFBETALOC should be set to the location of a beta version of Firefox)
endif

check-ffdev:
ifndef FFDEVLOC
	$(error FFDEVLOC should be set to the location of a developer version of Firefox)
endif

check-ffnightly:
ifndef FFNIGHTLYLOC
	$(error FFNIGHTLYLOC should be set to the location of a nightly version of Firefox)
endif

docs:
	jsdoc . -c jsdoc-conf.json
.PHONY : docs
