# nsfitbit

This repository has the source code for a simple Nightscout Fitbit watchface.

**Some of the features includes**

* Recent glucose values, boluses and basals are plotted as a graph
* OpenAPS and Loop prediction plotting
* Daily steps and current heart rate are displayed
* Predictive CGM alarms
* Option to choose number of hours for CGM and prediction plots
* Option to have the screen be on all the time (for Versa 1 and Versa Lite only, Versa 2 does not support this option)

![Screenshot](/screenshots/Screenshot%202020-10-02%20at%2012.16.24.png?raw=true "Screen capture of the watchface")
![Screenshot](/screenshots/Screenshot%202020-10-05%20at%2010.02.26.png?raw=true "Screen capture of the watchface")

![Screenshot](/screenshots/Screenshot%202020-10-14%20at%2010.24.48.png?raw=true "Screen capture of the watchface")
![Screenshot](/screenshots/Screenshot%202020-10-14%20at%2010.25.25.png?raw=true "Screen capture of the watchface")

# SDK 4.2 and SDK 5 support

Due to Fitbit devices needing separate builds under SDK 4.2 and 5, the project now has a separate
folder for the "project" for each SDK version. Sadly typescript has a bug that prevents symlinking
to the shared sources, so this is handled with source file copying.

Editing the sources is expected to happen in the project root folders.

If you need to make a build for a specific SDK, cd into the sdk4 or sdk5 folders and run
``yarn install; yarn run build`` and then install the build to the Fitbit simulator or
device with ``npx fitbit`` and running the ``install` command there.

SDK 6 builds also use the sdk5 directory.

# Tests

Run unit tests by changing to the correct SDK directory and running ``yarn run test``.
