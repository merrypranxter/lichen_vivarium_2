/* Artist-facing controls for the coherent-material foliose study.
   The existing simulation/renderer remains authoritative through this adapter. */
(function () {
  'use strict';
  window.setupLichenSpecimenStudio = function setupLichenSpecimenStudio(api) {
    const {params} = api;
    const host = document.getElementById('tab-optics');
    if (!host || document.getElementById('specimenStudio')) return;
    params.realismEnabled ??= true;
    params.materialDebug ??= 0;
    params.renderLayer ??= 'composite';
    params.tissueCharacter ??= 0.55;
    params.marginEnergy ??= 0.55;
    params.exposure ??= 1;

    const panel = document.createElement('section');
    panel.id = 'specimenStudio';
    panel.className = 'specimen-studio';
    panel.setAttribute('aria-labelledby', 'specimenTitle');
    panel.innerHTML = `
      <div class="specimen-title-row"><h2 id="specimenTitle">Material study</h2><span>Foliose · fictional phenotype</span></div>
      <p class="specimen-copy">Impossible pigment, substantial tissue. Inspect a fixed specimen, then shape its light and wetness.</p>
      <div class="specimen-actions"><button type="button" id="loadStudySpecimen">Load study specimen</button><button type="button" id="restoreStudyArtwork" disabled>Return to artwork</button></div>
      <label class="specimen-check"><input id="coherentMaterial" type="checkbox"> Coherent tissue material <span>Off: legacy comparison</span></label>
      <div class="specimen-selects">
        <label for="materialStudyView">Surface view<select id="materialStudyView">
          <option value="0">Finished material</option><option value="1">Neutral tissue</option><option value="2">Albedo</option><option value="3">Normals</option><option value="4">Roughness</option><option value="5">Local hydration</option><option value="6">Specular light</option><option value="7">Silhouette</option>
        </select></label>
        <label for="materialStudyLayer">Render layer<select id="materialStudyLayer"><option value="composite">Complete scene</option><option value="base">Base surface</option><option value="mesh">Raised anatomy</option></select></label>
      </div>
      <div class="specimen-actions"><button type="button" id="studyDry">Dry tissue</button><button type="button" id="studyMist">Mist tissue</button><button type="button" id="studyReference">Reference light</button><button type="button" id="studyCinematic">Cinematic light</button></div>
      <label class="specimen-slider" for="studyTissue">Tissue character <output id="studyTissueValue"></output><input id="studyTissue" type="range" min="0" max="1" step="0.01"></label>
      <label class="specimen-slider" for="studyMargin">Margin energy <output id="studyMarginValue"></output><input id="studyMargin" type="range" min="0" max="1" step="0.01"></label>
      <label class="specimen-slider" for="studyExposure">Exposure <output id="studyExposureValue"></output><input id="studyExposure" type="range" min="0.5" max="2" step="0.01"></label>
      <div class="specimen-actions"><button type="button" id="showExhibition">Exhibition view</button></div>
      <p id="specimenStudyStatus" class="specimen-status" role="status">The study replaces the scene temporarily; Return to artwork restores it.</p>`;
    host.prepend(panel);
    const $ = id => document.getElementById(id);
    const status = text => { $('specimenStudyStatus').textContent = text; };
    const exportBusy = () => Boolean($('exportGifBtn')?.disabled);
    const render = () => { if (!exportBusy() && typeof api.render === 'function') api.render(); };
    const canSwitchArtwork = () => {
      if (!exportBusy()) return true;
      status('Finish or cancel the export before switching artwork.');
      return false;
    };
    let previousArtwork = null;
    $('coherentMaterial').checked = params.realismEnabled;
    $('coherentMaterial').addEventListener('change', event => {
      params.realismEnabled = event.target.checked;
      syncMaterialAvailability();
      status(params.realismEnabled ? 'Coherent material: opaque cortex, local hydration and shared lighting.' : 'Legacy comparison: the original material treatment.');
      render();
    });
    $('materialStudyView').value = String(params.materialDebug);
    $('materialStudyView').addEventListener('change', event => {
      params.materialDebug = Number(event.target.value);
      render();
    });
    $('materialStudyLayer').value = params.renderLayer;
    $('materialStudyLayer').addEventListener('change', event => {
      params.renderLayer = event.target.value;
      render();
    });
    $('loadStudySpecimen').addEventListener('click', () => {
      if (!canSwitchArtwork()) return;
      if (previousArtwork === null) previousArtwork = api.capture();
      api.loadSpecimen();
      syncTransport(false);
      $('restoreStudyArtwork').disabled = false;
      refresh();
      status('Fixed foliose study loaded. Dry or mist the tissue to inspect its response.');
      render();
    });
    $('restoreStudyArtwork').addEventListener('click', () => {
      if (previousArtwork === null || !canSwitchArtwork()) return;
      api.restore(previousArtwork);
      syncTransport(previousArtwork.state?.isRunning);
      previousArtwork = null;
      $('restoreStudyArtwork').disabled = true;
      refresh();
      status('Your previous artwork and settings are restored.');
      render();
    });
    $('studyDry').addEventListener('click', () => {
      api.setWet(0.08);
      syncExistingControls();
      status('Drying environment set. Tissue water and curl relax at their own rates.');
      render();
    });
    $('studyMist').addEventListener('click', () => {
      api.setWet(1);
      syncExistingControls();
      status('Mist applied. Tissue absorbs water before its shape settles.');
      render();
    });
    function setLighting(cinematic) {
      params.macroOptics = cinematic ? 0.45 : 0;
      params.iridescence = cinematic ? 0.22 : 0;
      params.fluorescence = cinematic ? 0.12 : 0;
      params.lightAzimuth = (cinematic ? 135 : 115) * Math.PI / 180;
      params.lightElevation = (cinematic ? 22 : 45) * Math.PI / 180;
      params.grayscaleProof = false;
      syncExistingControls();
      status(cinematic ? 'Cinematic light: raking sun and restrained optical effects.' : 'Reference light: clear anatomy with optical effects removed.');
      render();
    }
    $('studyReference').addEventListener('click', () => setLighting(false));
    $('studyCinematic').addEventListener('click', () => setLighting(true));
    const sliders = [
      ['studyTissue', 'tissueCharacter', value => Math.round(value * 100) + '%'],
      ['studyMargin', 'marginEnergy', value => Math.round(value * 100) + '%'],
      ['studyExposure', 'exposure', value => value.toFixed(2) + '×']
    ];
    for (const [id, name, format] of sliders) {
      $(id).addEventListener('input', event => {
        params[name] = Number(event.target.value);
        $(id + 'Value').textContent = format(params[name]);
        render();
      });
    }
    function syncTransport(running) {
      if (typeof running !== 'boolean') return;
      if ($('playPauseIcon')) $('playPauseIcon').textContent = running ? '⏸' : '▶';
      if ($('playPauseText')) $('playPauseText').textContent = running ? 'Pause' : 'Grow';
      if ($('statusDot')) $('statusDot').className = running
        ? 'inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse'
        : 'inline-block w-2.5 h-2.5 rounded-full bg-amber-400';
    }
    function syncExistingControls() {
      const values = [
        ['lightAzimuthSlider', 'lightAzimuthVal', params.lightAzimuth * 180 / Math.PI, value => Math.round(value) + '°'],
        ['lightElevationSlider', 'lightElevationVal', params.lightElevation * 180 / Math.PI, value => Math.round(value) + '°'],
        ['iridescenceSlider', 'iridescenceVal', params.iridescence, value => value.toFixed(2)],
        ['fluorescenceSlider', 'fluorescenceVal', params.fluorescence, value => value.toFixed(2)],
        ['dofSlider', 'dofVal', params.macroOptics, value => value.toFixed(2)],
        ['zoomSlider', 'zoomVal', params.zoom, value => value.toFixed(2) + 'x'],
        ['hydrationSlider', 'hydrationVal', params.ambientHydration, value => value.toFixed(2)]
      ];
      for (const [input, output, value, format] of values) {
        if (typeof value !== 'number') continue;
        if ($(input)) $(input).value = String(value);
        if ($(output)) $(output).textContent = format(value);
      }
      if ($('geometryQualitySelect')) $('geometryQualitySelect').value = params.geometryQuality;
      if ($('scaleBarLabel')) $('scaleBarLabel').textContent = ((document.getElementById('scaleBarRule')?.getBoundingClientRect().width||48)/(api.canvas.getBoundingClientRect().width||512)*50/params.zoom).toFixed(1) + ' mm';
      document.querySelectorAll('.palette-pill').forEach(button => {
        button.classList.toggle('active', Number(button.dataset.palette) === params.paletteMode);
      });
      const badge = $('grayscaleBadge');
      if (badge) badge.classList.toggle('hidden', !params.grayscaleProof);
    }
    function syncMaterialAvailability() {
      for (const id of ['materialStudyView', 'studyTissue', 'studyMargin', 'studyExposure']) {
        $(id).disabled = !params.realismEnabled;
        $(id).title = params.realismEnabled ? '' : 'Available with coherent tissue material';
      }
    }
    function refresh() {
      syncMaterialAvailability();
      syncExistingControls();
      $('coherentMaterial').checked = params.realismEnabled;
      $('materialStudyView').value = String(params.materialDebug);
      $('materialStudyLayer').value = params.renderLayer;
      for (const [id, name, format] of sliders) {
        $(id).value = String(params[name]);
        $(id + 'Value').textContent = format(params[name]);
      }
    }
    const returnButton = document.createElement('button');
    returnButton.id = 'leaveExhibition';
    returnButton.type = 'button';
    returnButton.className = 'specimen-exhibition-return';
    returnButton.textContent = 'Return to studio';
    returnButton.hidden = true;
    document.body.appendChild(returnButton);
    function exhibition(enabled) {
      document.body.classList.toggle('exhibition', enabled);
      returnButton.hidden = !enabled;
      requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); render(); });
      if (enabled) returnButton.focus();
      else $('showExhibition').focus();
    }
    $('showExhibition').addEventListener('click', () => exhibition(true));
    returnButton.addEventListener('click', () => exhibition(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('exhibition')) exhibition(false);
    });
    refresh();
    // Explicit opt-in test adapter: ordinary artwork pages do not expose mutable state.
    if (new URLSearchParams(window.location.search).get('study') === '1') {
      window.lichenStudy = {...api, refresh, exhibition};
    }
    return {refresh, exhibition};
  };
})();
