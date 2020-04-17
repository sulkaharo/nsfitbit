function mySettings(props) {
  return (
    <Page>
        <TextInput
          label="Nightscout URL"
          subLabel="For example, https://itsmysite.heroku.com/"
          settingsKey="endpoint"
        />

        <TextInput
        label="API SECRET (if enabled)"
        settingsKey="apiSecret"
        />

        <Toggle
          settingsKey="usemgdl"
          label={`Units: ${props.settingsStorage.getItem('usemgdl')== 'true' ? 'mgdl' : 'mmol'}`}
        />

        <TextInput
          label="High BG threshold"
          settingsKey="highThreshold"
        />

        <TextInput
          label="Low BG threshold"
          settingsKey="lowThreshold"
        />

        <Toggle
          settingsKey="multicolor"
          label={`Multi color BG graph: ${props.settingsStorage.getItem('multicolor') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('multicolor', value ? 'yes' : 'no')}
        />

        <Toggle
          settingsKey="shownoise"
          label={`Show BG noise value: ${props.settingsStorage.getItem('shownoise') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('shownoise', value ? 'yes' : 'no')}
        />

        <Toggle
          settingsKey="graphDynamicScale"
          label={`Graph dynamic scaling: ${props.settingsStorage.getItem('graphDynamicScale') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('graphDynamicScale', value ? 'yes' : 'no')}
        />

        <TextInput
          label="Graph top BG"
          settingsKey="graphTopBG"
        />

        <Toggle
          settingsKey="activity"
          label={`Show HR & Steps: ${props.settingsStorage.getItem('activity') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('activity', value ? 'yes' : 'no')}
        />

<Select
  label={`Number of hours to plot`}
  title="CGM plot hours"
  settingsKey="cgmHours"
  options={[
    {name:"1", value: 1},
    {name:"2", value: 2},
    {name:"3", value: 3},
    {name:"4", value: 4}
  ]}
/>

<Select
  label={`Number of hours to plot`}
  title="OpenAPS / Loop predictions"
  settingsKey="predictionHours"
  options={[
    {name:"0", value: 0},
    {name:"1", value: 1},
    {name:"2", value: 2},
    {name:"3", value: 3}
  ]}
/>

        <Toggle
        settingsKey="enableAlarms"
        label={`Enable alarms: ${props.settingsStorage.getItem('enableAlarms') === 'true' ? 'yes' : 'no'}`}
        onChange={value => props.settingsStorage.getItem('enableAlarms', value ? 'yes' : 'no')}
        />

        <Select
  label={`Predictive alarms`}
  settingsKey="alarmPredictions"
  options={[
    {name:"None", value: 0},
    {name:"1 CGM reading ahead", value: 1},
    {name:"2 CGM readings ahead", value: 2},
    {name:"3 CGM readings ahead", value: 3}
  ]}
/>

<Select
  label={`CGM data age in minutes until alarm`}
  title="Stale CGM data alarms"
  settingsKey="staleAlarm"
  options={[
    {name:"Disabled", value: 0},
    {name:"15", value: 15},
    {name:"20", value: 20},
    {name:"25", value: 25},
    {name:"30", value: 30},
    {name:"45", value: 45},
    {name:"60", value: 60},
    {name:"120", value: 120}
  ]}
/>

<Select
  label={`Status line 1`}
  settingsKey="statusLine1"
  options={[
    {name:"None"},
    {name:"IOB"},
    {name:"COB"},
    {name:"BWP"},
    {name:"Heart rate"},
    {name:"Steps"}
  ]}
/>

<Select
  label={`Status line 2`}
  settingsKey="statusLine2"
  options={[
    {name:"None"},
    {name:"IOB"},
    {name:"COB"},
    {name:"BWP"},
    {name:"Heart rate"},
    {name:"Steps"}
  ]}
/>

        <Toggle
        settingsKey="alwaysOn"
        label={`Versa 1 screen: ${props.settingsStorage.getItem('alwaysOn') === 'true' ? 'always on' : 'sleep is on'}`}
        onChange={value => props.settingsStorage.getItem('alwaysOn', value ? 'always on' : 'sleep is on')}
        />
        <Toggle
        settingsKey="offOnNight"
        label={`Turn display off for the night (22-07): ${props.settingsStorage.getItem('offOnNight') === 'true' ? 'yes' : 'no'}`}
        onChange={value => props.settingsStorage.getItem('offOnNight', value ? 'yes' : 'no')}
        />
        
      <TextImageRow
        label="Fitbit Nightscout Monitor watchface"
        sublabel="@sulkaharo & @Tornado-Tim"
        icon="https://image.ibb.co/gbWF2H/twerp_bowtie_64.png"
      />
      <Text>
        This watchface is open source and can be found at https://github.com/sulkaharo/nsfitbit
        Special thanks to @Rytiggy / @nivz!
      </Text>
    </Page>
  );
}

registerSettingsPage(mySettings);
