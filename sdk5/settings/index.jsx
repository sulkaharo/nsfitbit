function mySettings(props) {
  return (
    <Page>
<Section
 title={<Text bold align="center">Nightscout address and API_SECRET</Text>}
 description={<Text>For Nightscout URL, just enter the base URL, for example http://mysite.herokuapp.com/</Text>}
 >

        <TextInput
          label="Tap here to set the URL"
          placeholder="https://mysite.herokuapp.com"
          settingsKey="endpoint"
        />

        <TextInput
        label="API SECRET or access token (if you've enabled this)"
        settingsKey="apiSecret"
        />
</Section>

<Section
 title={<Text bold align="center">Units and thresholds</Text>}
 description={<Text>High and Low BG thresholds are used for both the graph plotting
   as well as alarms, if enabled
 </Text>}
 >

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

</Section>

<Section
 title={<Text bold align="center">Graph settings</Text>}
 >

        <Toggle
          settingsKey="multicolor"
          label={`Multi color BG graph: ${props.settingsStorage.getItem('multicolor') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('multicolor', value ? 'yes' : 'no')}
        />

<Text>Dynamic scaling adjusts the graph height automatically on the fly.
  If you enable dynamic scaling, set the Graph Top BG below.
</Text>
        <Toggle
          settingsKey="graphDynamicScale"
          label={`Graph dynamic scaling: ${props.settingsStorage.getItem('graphDynamicScale') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('graphDynamicScale', value ? 'yes' : 'no')}
        />

<Text>Graph Top BG sets the top of the BG graph - values higher than
  the top will be plogged as a straight line on the top of the chart
</Text>

        <TextInput
          label="Tap to set graph top BG"
          settingsKey="graphTopBG"
        />


<Select
  label={`Number of CGM data hours to plot`}
  settingsKey="cgmHours"
  options={[
    {name:"1", value: 1},
    {name:"2", value: 2},
    {name:"3", value: 3},
    {name:"4", value: 4}
  ]}
/>

<Select
  label={`Number of BG prediction hours to plot`}
  settingsKey="predictionHours"
  options={[
    {name:"0", value: 0},
    {name:"1", value: 1},
    {name:"2", value: 2},
    {name:"3", value: 3}
  ]}
/>

</Section>

<Section
 title={<Text bold align="center">Alarms</Text>}
 >

        <Toggle
        settingsKey="enableAlarms"
        label={`Enable alarms: ${props.settingsStorage.getItem('enableAlarms') === 'true' ? 'yes' : 'no'}`}
        onChange={value => props.settingsStorage.getItem('enableAlarms', value ? 'yes' : 'no')}
        />

        <Select
  label={`Tap to set predictive alarms`}
  settingsKey="alarmPredictions"
  options={[
    {name:"None", value: 0},
    {name:"1 CGM reading ahead", value: 1},
    {name:"2 CGM readings ahead", value: 2},
    {name:"3 CGM readings ahead", value: 3}
  ]}
/>

<Select
  label={`Tap to set stale CGM data alarm`}
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

<Toggle
        settingsKey="alarmsOffDuringNight"
        label={`Turn alarms off during the night (21-07): ${props.settingsStorage.getItem('alarmsOffDuringNight') === 'true' ? 'yes' : 'no'}`}
        onChange={value => props.settingsStorage.getItem('offOnNight', value ? 'yes' : 'no')}
        />

<Toggle
        settingsKey="alarmOffBody"
        label={`Disable alarms when watch not worn: ${props.settingsStorage.getItem('alarmOffBody') === 'true' ? 'yes' : 'no'}`}
        onChange={value => props.settingsStorage.getItem('alarmOffBody', value ? 'yes' : 'no')}
        />

</Section>

<Section
 title={<Text bold align="center">Other data to show</Text>}
 >

<Text>Add IOB, COB, other data to the watchface. Note for IOB, COB and BWP, 
  the corresponding featuere must be enabled in Nighscout.
</Text>

<Select
  label={`Tap to set status line 1`}
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
  label={`Tap to set status line 2`}
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
          settingsKey="shownoise"
          label={`Show BG noise if available: ${props.settingsStorage.getItem('shownoise') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('shownoise', value ? 'yes' : 'no')}
        />

        <Toggle
          settingsKey="activity"
          label={`Show HR & Steps: ${props.settingsStorage.getItem('activity') === 'true' ? 'yes' : 'no'}`}
          onChange={value => props.settingsStorage.getItem('activity', value ? 'yes' : 'no')}
        />
</Section>

<Section
 title={<Text bold align="center">Other settings</Text>}
 >
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

      </Section>

    </Page>
  );
}

registerSettingsPage(mySettings);
