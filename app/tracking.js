//import sleep from "sleep";

export default class Tracking {

  constructor(settings) {

    this.settings = settings;

    if (sleep) {
      sleep.onchange = () => {
        console.log(`User sleep state is: ${sleep!.state}`);
      }
    } else {
      console.log("Sleep API not supported on this device, or no permission");
    }

  }
}
